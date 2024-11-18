const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg';
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';


let myMap;
let zones = {}; 
const initialCenter = [60.007899, 30.390313]; 
const initialZoom = 14; 
const zoneMappings = {
    "48": "Ремонт и реконструкция",
    "47": "Озеленение",
    "46": "Социальная инфрастуктура",
    "45": "Благоустройство" 
};

function sanitizeId(name) {
    return name ? name.replace(/\s+/g, '_').replace(/[^\p{L}\d\-_]/gu, '') : '';
}

document.addEventListener("DOMContentLoaded", function () {
    const locationButton = document.getElementById("get-location");
    const locationDisplay = document.getElementById("location-display");

    locationButton.addEventListener("click", function () {
        // Проверяем поддержку Geolocation API
        if (navigator.geolocation) {
            locationDisplay.textContent = "Определяем местоположение...";
            
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const { latitude, longitude } = position.coords;
                    locationDisplay.innerHTML = `Ваше местоположение:<br>
                    Широта: ${latitude.toFixed(5)}<br>
                    Долгота: ${longitude.toFixed(5)}`;
                },
                function (error) {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            locationDisplay.textContent = "Ошибка: доступ к геолокации запрещен.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            locationDisplay.textContent = "Ошибка: информация о местоположении недоступна.";
                            break;
                        case error.TIMEOUT:
                            locationDisplay.textContent = "Ошибка: запрос на определение местоположения завершился по тайм-ауту.";
                            break;
                        default:
                            locationDisplay.textContent = "Ошибка: невозможно определить местоположение.";
                            break;
                    }
                }
            );
        } else {
            locationDisplay.textContent = "Geolocation API не поддерживается вашим браузером.";
        }
    });
});



function fetchSheetNames() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
    return fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching sheet list: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const sheets = data.sheets;
            if (!sheets) throw new Error('Failed to get sheet list');
            return sheets.map(sheet => sheet.properties.title);
        })
        .catch(error => {
            console.error('Error fetching sheet list:', error);
            return [];
        });
}

function flattenCoords(coords) {
    let flatCoords = [];
    coords.forEach(function(coord) {
        if (Array.isArray(coord[0])) {
            flatCoords = flatCoords.concat(flattenCoords(coord));
        } else {
            flatCoords.push(coord);
        }
    });
    return flatCoords;
}



function fetchZoneData(zoneKey, sheetName, color) {
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

            const zoneName = zoneKey; // Настоящее название зоны
            const zoneDisplayName = sheetName;  // Это название листа из Google Таблицы

            if (!zones[zoneKey]) {
                zones[zoneKey] = { 
                    polygon: null, 
                    label: null,
                    groups: {}, 
                    isVisible: false, 
                    polygonVisible: false,
                    zoneName: zoneName, // Сохраняем "Зона 1"
                    zoneDisplayName: zoneDisplayName // Сохраняем "Ремонт и реконструкция"
                };
            }

            // Генерация HTML для зоны с использованием zoneKey и zoneName
            generateZoneHTML(zoneKey, zoneDisplayName, color);

            // Парсинг координат полигона (столбец с индексом 9)
            const polygonCoordsString = rows[1][9];
            let coordinates;
            if (polygonCoordsString) {
                try {
                    coordinates = JSON.parse(polygonCoordsString);
                    coordinates = swapCoordinates(coordinates);

                    // Создаем полигон
                    zones[zoneKey].polygon = new ymaps.Polygon(coordinates, {}, {
                        fillColor: color,
                        strokeColor: '#333',
                        opacity: 0.4,
                    });

                    // Вычисляем центр полигона из координат
const flatCoords = flattenCoords(coordinates);
const bounds = ymaps.util.bounds.fromPoints(flatCoords);
const center = ymaps.util.bounds.getCenter(bounds);


                    // Создаем метку с названием зоны
zones[zoneKey].label = new ymaps.Placemark(center, {
    iconCaption: zoneName, // Это "Зона 1"
}, {
    preset: 'islands#blueCircleDotIconWithCaption',
    iconCaptionMaxWidth: '200',
    iconColor: color,
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

                if (!zones[zoneKey].groups[group]) {
                    zones[zoneKey].groups[group] = { subgroups: {}, objects: [] };
                    generateGroupHTML(zoneKey, group);
                }

                let targetArray;
                if (subgroup) {
                    if (!zones[zoneKey].groups[group].subgroups[subgroup]) {
                        zones[zoneKey].groups[group].subgroups[subgroup] = [];
                        generateSubgroupHTML(zoneKey, group, subgroup);
                    }
                    targetArray = zones[zoneKey].groups[group].subgroups[subgroup];
                } else {
                    targetArray = zones[zoneKey].groups[group].objects;
                }

                generateObjectHTML(zoneKey, group, subgroup, id, title);

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
            setupAccordion(zoneKey);
        })
        .catch(error => console.error(`Ошибка при загрузке данных с листа ${sheetName}:`, error));
}




ymaps.ready(init);


function init() {
    myMap = new ymaps.Map("map", { center: initialCenter, zoom: initialZoom });

    const colors = [
        '#FFA50088', '#4682B488', '#1E90FF', '#32CD32'
    ];

    let zoneKeys = Object.keys(zoneMappings); // ["Зона 1", "Зона 2", "Зона 3", "Зона 4"]

    let loadPromises = zoneKeys.map((zoneKey, index) => {
        const sheetName = zoneMappings[zoneKey];
        const color = colors[index % colors.length];
        return fetchZoneData(zoneKey, sheetName, color);
    });

    // После загрузки всех зон
    Promise.all(loadPromises).then(() => {
        // Выпадающий список уже содержит фиксированные значения
    });

    // Обработчик для выпадающего списка
    const zoneSelect = document.getElementById('zone-select');
    zoneSelect.addEventListener('change', function () {
        const selectedZone = this.value;

        // Скрываем все полигоны
        for (let zoneKey in zones) {
            hideZonePolygon(zoneKey);
        }

        if (selectedZone === 'all') {
            // Отображаем все полигоны
            for (let zoneKey in zones) {
                showZonePolygon(zoneKey);
            }
        } else if (zones[selectedZone]) {
            // Отображаем выбранный полигон
            showZonePolygon(selectedZone);
        }
    });
}

function populateZoneDropdown() {
    const zoneSelect = document.getElementById('zone-select');
    zoneSelect.innerHTML = ''; // Очищаем текущие опции

    // Добавляем опции по умолчанию
    zoneSelect.innerHTML = `
        <option value="">Выберите зону:</option>
        <option value="all">Все</option>
    `;

    // Используем ключи из zoneMappings для заполнения списка
    for (let zoneKey in zoneMappings) {
        const option = document.createElement('option');
        option.value = zoneKey;
        option.textContent = zoneKey;
        zoneSelect.appendChild(option);
    }
}



function generateZoneHTML(zoneKey, zoneDisplayName, color) {
    const controls = document.getElementById('controls');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'section';
    zoneDiv.id = `zone-section-${sanitizeId(zoneKey)}`;
    zoneDiv.innerHTML = `
        <div class="accordion-header" id="zone-header-${sanitizeId(zoneKey)}">
            <span class="zone-title">${zoneDisplayName}</span>
        </div>
        <div class="accordion-content hidden" id="zone-content-${sanitizeId(zoneKey)}">
        </div>
    `;
    controls.appendChild(zoneDiv);
}



function generateGroupHTML(zoneKey, groupName) {
    const section = document.getElementById(`zone-content-${sanitizeId(zoneKey)}`);
    if (!section) {
        console.error(`Не удалось найти секцию зоны: zone-content-${sanitizeId(zoneKey)}`);
        return;
    }
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <div class="accordion-header" id="group-header-${sanitizeId(zoneKey)}-${sanitizeId(groupName)}">
            <span class="category-title">${groupName}</span>
        </div>
        <div class="accordion-content hidden" id="group-content-${sanitizeId(zoneKey)}-${sanitizeId(groupName)}">
        </div>
    `;
    section.appendChild(groupDiv);

    // Установка обработчика для аккордеона группы
    const groupHeader = document.getElementById(`group-header-${sanitizeId(zoneKey)}-${sanitizeId(groupName)}`);
    const groupContent = document.getElementById(`group-content-${sanitizeId(zoneKey)}-${sanitizeId(groupName)}`);
    groupHeader.addEventListener('click', () => {
        groupContent.classList.toggle('hidden');
        const isExpanded = !groupContent.classList.contains('hidden');
        toggleGroupObjects(zoneKey, groupName, isExpanded);
    });
}


function toggleGroupObjects(zoneName, groupName, show) {
    const zone = zones[zoneName];
    if (!zone || !zone.groups[groupName]) return;
    const group = zone.groups[groupName];

    // Отображаем или скрываем объекты без подгруппы
    group.objects.forEach(obj => {
        if (show) {
            myMap.geoObjects.add(obj.placemark);
        } else {
            myMap.geoObjects.remove(obj.placemark);
        }
    });

    // Отображаем или скрываем объекты подгрупп (если подгруппы развернуты)
    for (let subgroupName in group.subgroups) {
        const subgroupContent = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(subgroupName)}`);
        const isSubgroupExpanded = subgroupContent && !subgroupContent.classList.contains('hidden');
        toggleSubgroupObjects(zoneName, groupName, subgroupName, show && isSubgroupExpanded);
    }
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
        const isExpanded = !subgroupContent.classList.contains('hidden');
        toggleSubgroupObjects(zoneName, groupName, subgroupName, isExpanded);
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

function setupAccordion(zoneKey) {
    const zoneHeader = document.getElementById(`zone-header-${sanitizeId(zoneKey)}`);
    const zoneContent = document.getElementById(`zone-content-${sanitizeId(zoneKey)}`);

    zoneHeader.addEventListener('click', () => {
        zoneContent.classList.toggle('hidden');
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

function toggleSubgroupObjects(zoneName, groupName, subgroupName, show) {
    const zone = zones[zoneName];
    if (!zone || !zone.groups[groupName]) return;
    const objectList = zone.groups[groupName].subgroups[subgroupName];
    if (!objectList) return;

    objectList.forEach(obj => {
        if (show) {
            myMap.geoObjects.add(obj.placemark);
        } else {
            myMap.geoObjects.remove(obj.placemark);
        }
    });
}



function showZonePolygon(zoneKey) {
    const zone = zones[zoneKey];
    if (!zone || zone.polygonVisible) return;

    if (zone.polygon) {
        myMap.geoObjects.add(zone.polygon);
    }
    if (zone.label) {
        myMap.geoObjects.add(zone.label);
    }
    zone.polygonVisible = true;
}



function hideZonePolygon(zoneKey) {
    const zone = zones[zoneKey];
    if (!zone || !zone.polygonVisible) return;

    if (zone.polygon) {
        myMap.geoObjects.remove(zone.polygon);
    }
    if (zone.label) {
        myMap.geoObjects.remove(zone.label);
    }
    zone.polygonVisible = false;
}

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


