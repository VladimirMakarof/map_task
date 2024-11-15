const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg';
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';

let myMap;
let zones = {}; // Хранит зоны, группы и объекты
const initialCenter = [60.007899, 30.390313]; // Начальный центр карты
const initialZoom = 14; // Начальный масштаб карты

function sanitizeId(name) {
    return name.replace(/\s+/g, '_').replace(/[^\p{L}\d\-_]/gu, '');
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
            if (!rows) throw new Error(`Данные с листа ${sheetName} пусты или недоступны`);

            const zoneName = sheetName;
            if (!zones[zoneName]) zones[zoneName] = { polygon: null, groups: {}, isVisible: false };
            generateZoneHTML(zoneName, color);

            const polygonCoordsString = rows[1][8];
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

            for (let i = 1; i < rows.length; i++) {
                const [
                    id, group, title, lat, lon, link, imageUrl, iconPreset,
                    , // Пропускаем столбец "Координаты полигона"
                    firstDate, firstDateLink, secondDate, secondDateLink
                ] = rows[i];

                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (!zones[zoneName].groups[group]) {
                    zones[zoneName].groups[group] = [];
                    generateGroupHTML(zoneName, group);
                }

                const placemarkPreset = iconPreset ? iconPreset.replace(/['"]/g, '').trim() : 'islands#blueDotIcon';

                const firstDateContent = firstDate && firstDateLink 
                    ? `<p class="date-link"> <a href="${firstDateLink}" target="_blank">${firstDate}</a></p>` 
                    : '';
                const secondDateContent = secondDate && secondDateLink 
                    ? `<p class="date-link"> <a href="${secondDateLink}" target="_blank">${secondDate}</a></p>` 
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
                    preset: placemarkPreset
                });

                zones[zoneName].groups[group].push({ id, placemark });
                generateObjectHTML(zoneName, group, id, title);
            }

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
  '#FFA50088', '#4682B488', '#1E90FF', '#32CD32', '#FF6347', '#8A2BE2', '#FFD700',  '#FF69B4',  '#00FA9A', '#DA70D6',  '#40E0D0',  '#FF4500',  '#7B68EE', '#6A5ACD',  '#20B2AA',  '#9370DB'   
];
        sheetNames.forEach((sheetName, index) => {
            const color = colors[index % colors.length]; // Выбираем цвет из массива
            fetchZoneData(sheetName, color);
        });
    });

    const controls = document.getElementById('controls');
    const toggleButton = document.getElementById('toggle-button');

    toggleButton.addEventListener('click', () => {
        if (controls.classList.contains('hidden')) {
            controls.classList.remove('hidden');
            toggleButton.textContent = 'Скрыть настройки';
        } else {
            controls.classList.add('hidden');
            toggleButton.textContent = 'Показать настройки';
        }
        myMap.container.fitToViewport(); // Подстраиваем карту под изменения
    });
}

function setupAccordion(zoneName) {
    const zoneHeader = document.getElementById(`zone-header-${sanitizeId(zoneName)}`);
    const zoneContent = document.getElementById(`zone-content-${sanitizeId(zoneName)}`);

    zoneHeader.addEventListener('click', () => {
        const isExpanded = !zoneContent.classList.toggle('hidden');
        if (isExpanded) {
            showZonePolygonOnly(zoneName);
            myMap.setCenter(initialCenter, initialZoom); // Центрируем карту на начальные координаты
        } else {
            hideZone(zoneName);
        }
    });
}

function showZonePolygonOnly(zoneName) {
    const zone = zones[zoneName];
    if (!zone || zone.isVisible) return;

    if (zone.polygon) {
        myMap.geoObjects.add(zone.polygon);
    }
    zone.isVisible = true;
}



function showZone(zoneName) {
    const zone = zones[zoneName];
    if (!zone || zone.isVisible) return;

    myMap.geoObjects.add(zone.polygon);
    zone.isVisible = true;

    for (let groupName in zone.groups) {
        zone.groups[groupName].forEach(obj => {
            myMap.geoObjects.add(obj.placemark);
        });
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
        zone.groups[groupName].forEach(obj => {
            myMap.geoObjects.remove(obj.placemark);
        });
    }
}


function setAllCheckboxes(zoneName, isChecked) {
    const zone = zones[zoneName];
    if (!zone) return;

    for (let groupName in zone.groups) {
        const groupCheckbox = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
        groupCheckbox.checked = isChecked;

        zone.groups[groupName].forEach(obj => {
            const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(obj.id)}`);
            objectCheckbox.checked = isChecked;
            toggleObject(zoneName, groupName, obj.id, isChecked); // Обновляем состояние объекта на карте
        });
    }
}

function toggleGroup(zoneName, groupName, isChecked) {
    const zone = zones[zoneName];
    if (!zone) return;

    zone.groups[groupName].forEach(obj => {
        const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(obj.id)}`);
        objectCheckbox.checked = isChecked; // Синхронизируем состояние чекбоксов объектов
        if (isChecked) {
            myMap.geoObjects.add(obj.placemark);
        } else {
            myMap.geoObjects.remove(obj.placemark);
        }
    });
}

function toggleObject(zoneName, groupName, objectId, isChecked) {
    const zone = zones[zoneName];
    const object = zone.groups[groupName].find(obj => obj.id === objectId);

    if (isChecked) {
        myMap.geoObjects.add(object.placemark);
    } else {
        myMap.geoObjects.remove(object.placemark);
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
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <button class="category-title accordion-header" id="group${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
            ${groupName}
        </button>
        <div class="object-list hidden" id="objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
        </div>
    `;
    section.appendChild(groupDiv);

    // Добавляем обработчик события для кнопки
    const groupHeader = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    groupHeader.addEventListener('click', () => {
        const objectList = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
        const isExpanded = !objectList.classList.toggle('hidden');
        toggleGroup(zoneName, groupName, isExpanded);
    });
}


function generateObjectHTML(zoneName, groupName, objectId, title) {
    const objectList = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    const objectLabel = document.createElement('label');
    objectLabel.innerHTML = `
        <input type="checkbox" id="object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(objectId)}" checked onchange="toggleObject('${zoneName}', '${groupName}', '${objectId}', this.checked)">
        ${title}
    `;
    objectList.appendChild(objectLabel);
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



