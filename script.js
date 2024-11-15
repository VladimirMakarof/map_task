const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg';
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';


let myMap;
let zones = {}; // Хранит зоны, группы, подгруппы и объекты
const initialCenter = [60.007899, 30.390313]; // Начальный центр карты
const initialZoom = 14; // Начальный масштаб карты

function sanitizeId(name) {
    return name ? name.replace(/\s+/g, '_').replace(/[^\p{L}\d\-_]/gu, '') : '';
}

// Функция для получения списка листов
function fetchSheetNames() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке списка листов: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const sheets = data.sheets;
            if (!sheets) throw new Error('Не удалось получить список листов');
            return sheets.map(sheet => sheet.properties.title);
        })
        .catch(error => {
            console.error('Ошибка при получении списка листов:', error);
            return [];
        });
}

// Функция для получения данных с конкретного листа
function fetchZoneData(sheetName, color) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке данных с листа ${sheetName}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const rows = data.values;
            if (!rows || rows.length < 2) {
                throw new Error(`Данные с листа ${sheetName} пусты или недоступны`);
            }

            const zoneName = sheetName;
            if (!zones[zoneName]) {
                zones[zoneName] = { polygon: null, groups: {}, isVisible: false };
            }

            // Генерация HTML для зоны
            generateZoneHTML(zoneName, color);

            // Парсинг координат полигона (столбец с индексом 9)
            const polygonCoordsString = rows[1][9];
            let coordinates;
            if (polygonCoordsString) {
                try {
                    coordinates = JSON.parse(polygonCoordsString);
                    coordinates = swapCoordinates(coordinates);
                    zones[zoneName].polygon = new ymaps.Polygon(coordinates, {}, {
                        fillColor: color,
                        strokeColor: '#333',
                        opacity: 0.4,
                    });
                } catch (e) {
                    console.error(`Ошибка при парсинге координат полигона для зоны ${zoneName}:`, e);
                }
            }

            // Обработка строк с данными объектов
            for (let i = 1; i < rows.length; i++) {
                const [
                    id, group, subgroup, title, lat, lon, link, imageUrl, iconPreset,
                    , // Пропускаем столбец "Координаты полигона"
                    firstDate, firstDateLink, secondDate, secondDateLink
                ] = rows[i];

                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (!zones[zoneName].groups[group]) {
                    zones[zoneName].groups[group] = { subgroups: {}, objects: [] };
                    generateGroupHTML(zoneName, group);
                }

                let targetArray;
                if (subgroup) {
                    if (!zones[zoneName].groups[group].subgroups[subgroup]) {
                        zones[zoneName].groups[group].subgroups[subgroup] = [];
                        generateSubgroupHTML(zoneName, group, subgroup);
                    }
                    targetArray = zones[zoneName].groups[group].subgroups[subgroup];
                } else {
                    targetArray = zones[zoneName].groups[group].objects;
                }

                generateObjectHTML(zoneName, group, subgroup, id, title);

                const cleanIconPreset = (iconPreset || 'islands#blueDotIcon').replace(/['"]/g, '').trim();

                const firstDateContent = firstDate && firstDateLink
                    ? `<p class="date-link"><a href="${firstDateLink}" target="_blank">${firstDate}</a></p>`
                    : '';
                const secondDateContent = secondDate && secondDateLink
                    ? `<p class="date-link"><a href="${secondDateLink}" target="_blank">${secondDate}</a></p>`
                    : '';

                const placemark = new ymaps.Placemark([latitude, longitude], {
                    balloonContent: `
                        <div style="text-align: center;">
                            <div class="balloon-title">${title}</div>
                            ${firstDateContent}
                            ${secondDateContent}
                            <a href="${link}" target="_blank" class="balloon-link">Подробнее</a><br>
                            <img src="${imageUrl}" alt="${title}" class="balloon-image" style="width:200px; cursor:pointer; margin-top: 10px;">
                        </div>
                    `
                }, {
                    preset: cleanIconPreset
                });

                // Добавляем placemark в нужную группу/подгруппу
                targetArray.push({ id, placemark });
            }

            // Установка обработчиков для аккордеона
            setupAccordion(zoneName);
        })
        .catch(error => console.error(`Ошибка при загрузке данных с листа ${sheetName}:`, error));
}

ymaps.ready(init);

function init() {
    myMap = new ymaps.Map("map", { center: initialCenter, zoom: initialZoom });

    // Получаем список листов и для каждого загружаем данные
    fetchSheetNames().then(sheetNames => {
        const colors = [
            '#FFA50088', '#4682B488', '#1E90FF', '#32CD32', '#FF6347', '#8A2BE2', '#FFD700',
            '#FF69B4', '#00FA9A', '#DA70D6', '#40E0D0', '#FF4500', '#7B68EE', '#6A5ACD', '#20B2AA', '#9370DB'
        ];
        sheetNames.forEach((sheetName, index) => {
            const color = colors[index % colors.length];
            fetchZoneData(sheetName, color);
        });
    });
}

function generateZoneHTML(zoneName, color) {
    const controls = document.getElementById('controls');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'section';
    zoneDiv.id = `zone-section-${sanitizeId(zoneName)}`;
    zoneDiv.innerHTML = `
        <div class="accordion-header" id="zone-header-${sanitizeId(zoneName)}">
            <span class="zone-title">${zoneName}</span>
        </div>
        <div class="accordion-content hidden" id="zone-content-${sanitizeId(zoneName)}">
        </div>
    `;
    controls.appendChild(zoneDiv);
}

function generateGroupHTML(zoneName, groupName) {
    const section = document.getElementById(`zone-content-${sanitizeId(zoneName)}`);
    if (!section) {
        console.error(`Не удалось найти секцию зоны: zone-content-${sanitizeId(zoneName)}`);
        return;
    }
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <div class="accordion-header" id="group-header-${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
            <span class="category-title">${groupName}</span>
        </div>
        <div class="accordion-content hidden" id="group-content-${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
        </div>
    `;
    section.appendChild(groupDiv);

    // Установка обработчика для аккордеона группы
    const groupHeader = document.getElementById(`group-header-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    const groupContent = document.getElementById(`group-content-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    groupHeader.addEventListener('click', () => {
        groupContent.classList.toggle('hidden');
    });
}

function generateSubgroupHTML(zoneName, groupName, subgroupName) {
    const groupSection = document.getElementById(`group-content-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    if (!groupSection) {
        console.error(`Не удалось найти секцию группы: group-content-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
        return;
    }
    const subgroupDiv = document.createElement('div');
    subgroupDiv.className = 'subgroup';
    subgroupDiv.innerHTML = `
        <div class="accordion-header" id="subgroup-header-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}">
            <span class="subgroup-title">${subgroupName}</span>
        </div>
        <div class="accordion-content hidden" id="objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}">
        </div>
    `;
    groupSection.appendChild(subgroupDiv);

    // Установка обработчика для аккордеона подгруппы
    const subgroupHeader = document.getElementById(`subgroup-header-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}`);
    const subgroupContent = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}`);
    subgroupHeader.addEventListener('click', () => {
        subgroupContent.classList.toggle('hidden');
    });
}

function generateObjectHTML(zoneName, groupName, subgroupName, objectId, title) {
    const objectListId = subgroupName
        ? `objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}`
        : `group-content-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`;

    const objectList = document.getElementById(objectListId);
    if (!objectList) {
        console.error(`Не удалось найти список объектов для: ${objectListId}`);
        return;
    }

    const objectLabel = document.createElement('label');
    objectLabel.innerHTML = `
        <input type="checkbox" id="object${sanitizeId(zoneName)}-${sanitizeId(groupName)}${subgroupName ? '-' + sanitizeId(subgroupName) : ''}-${sanitizeId(objectId)}" checked onchange="toggleObject('${zoneName}', '${groupName}', '${subgroupName}', '${objectId}', this.checked)">
        ${title}
    `;
    objectList.appendChild(objectLabel);
}

function toggleObject(zoneName, groupName, subgroupName, objectId, isChecked) {
    const zone = zones[zoneName];
    if (!zone || !zone.groups[groupName]) return;
    const objectList = subgroupName ? zone.groups[groupName].subgroups[subgroupName] : zone.groups[groupName].objects;
    const object = objectList ? objectList.find(obj => obj.id === objectId) : null;

    if (object && object.placemark) {
        if (isChecked) {
            myMap.geoObjects.add(object.placemark);
        } else {
            myMap.geoObjects.remove(object.placemark);
        }
    }
}

function swapCoordinates(coords) {
    return coords.map(coord => {
        if (Array.isArray(coord[0])) {
            return swapCoordinates(coord);
        } else {
            return [coord[1], coord[0]];
        }
    });
}

function setupAccordion(zoneName) {
    const zoneHeader = document.getElementById(`zone-header-${sanitizeId(zoneName)}`);
    const zoneContent = document.getElementById(`zone-content-${sanitizeId(zoneName)}`);

    zoneHeader.addEventListener('click', () => {
        const isExpanded = !zoneContent.classList.toggle('hidden');
        if (isExpanded) {
            showZone(zoneName);
        } else {
            hideZone(zoneName);
        }
    });
}

function showZone(zoneName) {
    const zone = zones[zoneName];
    if (!zone || zone.isVisible) return;

    if (zone.polygon) {
        myMap.geoObjects.add(zone.polygon);
    }
    zone.isVisible = true;

    for (let groupName in zone.groups) {
        const group = zone.groups[groupName];
        group.objects?.forEach(obj => myMap.geoObjects.add(obj.placemark));
        for (let subgroupName in group.subgroups) {
            group.subgroups[subgroupName].forEach(obj => myMap.geoObjects.add(obj.placemark));
        }
    }
}

function hideZone(zoneName) {
    const zone = zones[zoneName];
    if (!zone || !zone.isVisible) return;

    if (zone.polygon) {
        myMap.geoObjects.remove(zone.polygon);
    }
    zone.isVisible = false;

    for (let groupName in zone.groups) {
        const group = zone.groups[groupName];
        group.objects?.forEach(obj => myMap.geoObjects.remove(obj.placemark));
        for (let subgroupName in group.subgroups) {
            group.subgroups[subgroupName].forEach(obj => myMap.geoObjects.remove(obj.placemark));
        }
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const formButton = document.getElementById('form-button');
    const formPopup = document.getElementById('form-popup');
    const formHolder = document.getElementById('formHolder');

    if (formButton) {
        formButton.addEventListener('click', function() {
            formPopup.classList.remove('hidden');

            // Инициализируем форму при первом открытии
            if (!window.formInitialized) {
                window.formInitialized = true; // Устанавливаем флаг, чтобы предотвратить повторную инициализацию

                (function() {
                    var f = 'externalFormStarterCallback', s = document.createElement('script');
                    window[f] = function(h) {
                        if (formHolder) {
                            console.log('Форма инициализируется');
                            h.bind(formHolder);
                        } else {
                            console.error('formHolder не найден');
                        }
                    };
                    s.type = 'text/javascript';
                    s.async = true;
                    s.src = 'https://pyrus.com/js/externalformstarter?jsonp=' + f + '&id=1524907';
                    document.head.appendChild(s);
                })();
            }
        });
    }

    // Закрытие модального окна при клике на крестик
    window.closeFormPopup = function() {
        formPopup.classList.add('hidden');
    };

    // Закрытие модального окна при клике вне формы
    formPopup.addEventListener('click', function(event) {
        if (event.target === formPopup) {
            closeFormPopup();
        }
    });
});


