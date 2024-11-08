const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg'; 
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';

let myMap;
let zones = {}; // Хранит зоны, группы и объекты

function sanitizeId(name) {
    return name.replace(/\s+/g, '_').replace(/[^\p{L}\d\-_]/gu, '');
}

function fetchZoneData(sheetName, zoneName, color) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке данных с листа ${sheetName}: ${response.statusText}`);
            }
            return response.json();
        })const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg'; 
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';

let myMap;
let zones = {}; // Хранит зоны, группы и объекты

function sanitizeId(name) {
    return name.replace(/\s+/g, '_').replace(/[^\p{L}\d\-_]/gu, '');
}

function fetchZoneData(sheetName, zoneName, color) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?key=${apiKey}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке данных с листа ${sheetName}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const rows = data.values;
            if (!rows) throw new Error(`Данные с листа ${sheetName} пусты или недоступны`);

            // Создаем зону, если она не была создана ранее
            if (!zones[zoneName]) zones[zoneName] = { polygon: null, groups: {} };

            generateZoneHTML(zoneName, color);

            // Считываем координаты полигона из ячейки I2 (строка 1, столбец 8)
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

            // Добавляем обработчик на чекбокс зоны
            document.getElementById(`zone${sanitizeId(zoneName)}`).addEventListener('change', () => toggleZone(zoneName));

            for (let i = 1; i < rows.length; i++) {
                const [
                    id, group, title, lat, lon, link, imageUrl, iconPreset,
                    , // Пропускаем столбец "Координаты полигона" (если он уже обработан)
                    firstDate, firstDateLink, secondDate, secondDateLink
                ] = rows[i];

                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (!zones[zoneName].groups[group]) {
                    zones[zoneName].groups[group] = [];
                    generateGroupHTML(zoneName, group);
                }

                const placemarkPreset = iconPreset ? iconPreset.replace(/['"]/g, '').trim() : 'islands#blueDotIcon';

                // Проверка наличия данных для первой и второй даты
const firstDateContent = firstDate && firstDateLink 
    ? `<p class="date-link"> <a href="${firstDateLink}" target="_blank">${firstDate}</a></p>` 
    : '';
const secondDateContent = secondDate && secondDateLink 
    ? `<p class="date-link"> <a href="${secondDateLink}" target="_blank">${secondDate}</a></p>` 
    : '';
                // Создание содержимого для баллона
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

                // Добавляем обработчик события 'balloonopen' для открытия popup при клике на изображение
                placemark.events.add('balloonopen', function (e) {
                    const target = e.get('target');
                    target.balloon.getOverlay().then(function(overlay) {
                        const balloonContent = overlay.getElement();
                        const imgElement = balloonContent.querySelector('.balloon-image');

                        if (imgElement) {
                            imgElement.addEventListener('click', function () {
                                showPopup(imageUrl);
                            });
                        }
                    });
                });

                zones[zoneName].groups[group].push({ id, placemark });
                generateObjectHTML(zoneName, group, id, title);
            }

            // Добавляем обработчики на чекбоксы групп и объектов
            for (let group in zones[zoneName].groups) {
                document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(group)}`).addEventListener('change', () => toggleGroup(zoneName, group));
                zones[zoneName].groups[group].forEach(obj => {
                    const checkbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(group)}-${obj.id}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => toggleObject(zoneName, group, obj.id));
                    }
                });
            }
        })
        .catch(error => console.error(`Ошибка при загрузке данных с листа ${sheetName}:`, error));
}





ymaps.ready(init);

function init() {
    myMap = new ymaps.Map("map", { center: [60.007899, 30.390313], zoom: 14 });

    // Загрузка данных для каждого округа
    fetchZoneData('46-ой Округ', '46-ой Округ', '#FFA50088');
    fetchZoneData('47-й Округ', '47-й Округ', '#4682B488');
    fetchZoneData('48-й ОКруг', '48-й ОКруг', '#1E90FF');
    fetchZoneData('45-й Округ', '45-й Округ', '#32CD32');

    const controls = document.getElementById('controls');
    const toggleButton = document.getElementById('toggle-button');

    toggleButton.addEventListener('click', function() {
        if (controls.classList.contains('hidden')) {
            controls.classList.remove('hidden');
            toggleButton.textContent = 'Скрыть настройки';
        } else {
            controls.classList.add('hidden');
            toggleButton.textContent = 'Показать настройки';
        }
    });
}

// Функции для управления видимостью объектов

function toggleZone(zoneName) {
    const zone = zones[zoneName];
    if (!zone) return;

    const zoneCheckbox = document.getElementById(`zone${sanitizeId(zoneName)}`);

    if (zoneCheckbox && zoneCheckbox.checked) {
        myMap.geoObjects.add(zone.polygon);
    } else if (zoneCheckbox) {
        myMap.geoObjects.remove(zone.polygon);
    }

    // Обновляем состояние групп и объектов внутри зоны
    for (let groupName in zone.groups) {
        const groupCheckbox = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
        if (groupCheckbox) {
            groupCheckbox.checked = zoneCheckbox.checked;
            toggleGroup(zoneName, groupName);
        }
    }
}

function swapCoordinates(coords) {
    return coords.map(coord => {
        if (Array.isArray(coord[0])) {
            return swapCoordinates(coord);
        } else {
            // Меняем местами долготу и широту
            return [coord[1], coord[0]];
        }
    });
}



function toggleGroup(zoneName, groupName) {
    const zone = zones[zoneName];
    const groupCheckbox = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);

    zone.groups[groupName].forEach(obj => {
        const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(obj.id)}`);
        if (groupCheckbox.checked) {
            objectCheckbox.checked = true;
            myMap.geoObjects.add(obj.placemark);
        } else {
            objectCheckbox.checked = false;
            myMap.geoObjects.remove(obj.placemark);
        }
    });
}

function toggleObject(zoneName, groupName, objectId) {
    const zone = zones[zoneName];
    const object = zone.groups[groupName].find(obj => obj.id === objectId);
    const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(objectId)}`);

    if (objectCheckbox && objectCheckbox.checked) {
        myMap.geoObjects.add(object.placemark);
    } else if (objectCheckbox) {
        myMap.geoObjects.remove(object.placemark);
    }
}

// Функция для отображения popup с изображением
function showPopup(imageUrl) {
    // Создаем контейнер для popup
    const popupOverlay = document.createElement('div');
    popupOverlay.classList.add('popup-overlay');

    // Контейнер для изображения и крестика
    popupOverlay.innerHTML = `
        <div class="popup-content">
            <span class="popup-close">×</span>
            <img src="${imageUrl}" alt="Image" class="popup-image">
        </div>
    `;

    // Добавляем обработчик клика по крестику
    popupOverlay.querySelector('.popup-close').addEventListener('click', closePopup);

    // Добавляем обработчик клика по overlay для закрытия popup
    popupOverlay.addEventListener('click', (event) => {
        if (event.target === popupOverlay) {
            closePopup();
        }
    });

    // Добавляем popup в body
    document.body.appendChild(popupOverlay);
}

function closePopup() {
    const popupOverlay = document.querySelector('.popup-overlay');
    if (popupOverlay) {
        popupOverlay.remove();
    }
}

// CSS для popup
const css = `
    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }

    .popup-content {
        position: relative;
    }

    .popup-image {
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
    }

    .popup-close {
        position: absolute;
        top: -10px;
        right: -10px;
        background-color: #fff;
        border-radius: 50%;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 24px;
    }
`;
const style = document.createElement('style');
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

// Определение функции generateZoneHTML
function generateZoneHTML(zoneName, color) {
    const controls = document.getElementById('controls');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'section';
    zoneDiv.id = `zone-section-${sanitizeId(zoneName)}`;
    zoneDiv.innerHTML = `
        <label class="zone-label">
            <input type="checkbox" id="zone${sanitizeId(zoneName)}">
            <span class="zone-title"> ${zoneName}</span>
        </label>
    `;
    controls.appendChild(zoneDiv);
}

// Определение функции generateGroupHTML
function generateGroupHTML(zoneName, groupName) {
    const section = document.getElementById(`zone-section-${sanitizeId(zoneName)}`);
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <label class="category-label">
            <input type="checkbox" id="group${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
            <span class="category-title">${groupName}</span>
        </label>
        <div class="object-list" id="objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
        </div>
    `;
    section.appendChild(groupDiv);
}

// Определение функции generateObjectHTML

function generateObjectHTML(zoneName, groupName, objectId, title) {
    const objectList = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    const objectLabel = document.createElement('label');
    objectLabel.innerHTML = `
        <input type="checkbox" id="object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(objectId)}"> ${title}
    `;
    objectList.appendChild(objectLabel);
}
        .then(data => {
            const rows = data.values;
            if (!rows) throw new Error(`Данные с листа ${sheetName} пусты или недоступны`);

            // Создаем зону, если она не была создана ранее
            if (!zones[zoneName]) zones[zoneName] = { polygon: null, groups: {} };

            generateZoneHTML(zoneName, color);

            // Считываем координаты полигона из ячейки I2 (строка 1, столбец 8)
            const polygonCoordsString = rows[1][8]; // Индексы начинаются с 0
            let coordinates;
            if (polygonCoordsString) {
    try {
        coordinates = JSON.parse(polygonCoordsString);
        coordinates = swapCoordinates(coordinates); // Меняем порядок координат
        zones[zoneName].polygon = new ymaps.Polygon(coordinates, {}, {
            fillColor: color,
            strokeColor: '#333',
            opacity: 0.4,
        });
        console.log(`Координаты полигона для зоны ${zoneName}:`, coordinates);
    } catch (e) {
        console.error(`Ошибка при парсинге координат полигона для зоны ${zoneName}:`, e);
    }
}


            // Добавляем обработчик на чекбокс зоны
            document.getElementById(`zone${sanitizeId(zoneName)}`).addEventListener('change', () => toggleZone(zoneName));

            for (let i = 1; i < rows.length; i++) {
                const [id, group, title, lat, lon, link, imageUrl, iconPreset] = rows[i];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (!zones[zoneName].groups[group]) {
                    zones[zoneName].groups[group] = [];
                    generateGroupHTML(zoneName, group);
                }

                console.log(`Adding ${title} to ${zoneName} -> ${group}`); 

                const placemarkPreset = iconPreset ? iconPreset.replace(/['"]/g, '').trim() : 'islands#blueDotIcon';
                const placemark = new ymaps.Placemark([latitude, longitude], {
                    balloonContent: `
                        <div>
                            <div class="balloon-title">${title}</div>
                            <a href="${link}" target="_blank" class="balloon-link">Подробнее</a><br>
                            <img src="${imageUrl}" alt="${title}" class="balloon-image" style="width:200px; cursor:pointer;">
                        </div>
                    `
                }, {
                    preset: placemarkPreset
                });

                // Добавляем обработчик события 'balloonopen' для открытия popup при клике на изображение
                placemark.events.add('balloonopen', function (e) {
                    const target = e.get('target');
                    target.balloon.getOverlay().then(function(overlay) {
                        const balloonContent = overlay.getElement();
                        const imgElement = balloonContent.querySelector('.balloon-image');

                        if (imgElement) {
                            imgElement.addEventListener('click', function () {
                                showPopup(imageUrl);
                            });
                        }
                    });
                });

                zones[zoneName].groups[group].push({ id, placemark });
                generateObjectHTML(zoneName, group, id, title);
            }

            // Добавляем обработчики на чекбоксы групп и объектов
            for (let group in zones[zoneName].groups) {
                document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(group)}`).addEventListener('change', () => toggleGroup(zoneName, group));
                zones[zoneName].groups[group].forEach(obj => {
                    const checkbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(group)}-${obj.id}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => toggleObject(zoneName, group, obj.id));
                    }
                });
            }
        })
        .catch(error => console.error(`Ошибка при загрузке данных с листа ${sheetName}:`, error));
}



ymaps.ready(init);

function init() {
    myMap = new ymaps.Map("map", { center: [60.007899, 30.390313], zoom: 14 });

    // Загрузка данных для каждого округа
    fetchZoneData('46-ой Округ', '46-ой Округ', '#FFA50088');
    fetchZoneData('47-й Округ', '47-й Округ', '#4682B488');
    fetchZoneData('48-й ОКруг', '48-й ОКруг', '#1E90FF');
    fetchZoneData('45-й Округ', '45-й Округ', '#32CD32');

    const controls = document.getElementById('controls');
    const toggleButton = document.getElementById('toggle-button');

    toggleButton.addEventListener('click', function() {
        if (controls.classList.contains('hidden')) {
            controls.classList.remove('hidden');
            toggleButton.textContent = 'Скрыть настройки';
        } else {
            controls.classList.add('hidden');
            toggleButton.textContent = 'Показать настройки';
        }
    });
}

// Функции для управления видимостью объектов

function toggleZone(zoneName) {
    const zone = zones[zoneName];
    if (!zone) return;

    const zoneCheckbox = document.getElementById(`zone${sanitizeId(zoneName)}`);

    if (zoneCheckbox && zoneCheckbox.checked) {
        myMap.geoObjects.add(zone.polygon);
    } else if (zoneCheckbox) {
        myMap.geoObjects.remove(zone.polygon);
    }

    // Обновляем состояние групп и объектов внутри зоны
    for (let groupName in zone.groups) {
        const groupCheckbox = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
        if (groupCheckbox) {
            groupCheckbox.checked = zoneCheckbox.checked;
            toggleGroup(zoneName, groupName);
        }
    }
}

function swapCoordinates(coords) {
    return coords.map(coord => {
        if (Array.isArray(coord[0])) {
            return swapCoordinates(coord);
        } else {
            // Меняем местами долготу и широту
            return [coord[1], coord[0]];
        }
    });
}



function toggleGroup(zoneName, groupName) {
    const zone = zones[zoneName];
    const groupCheckbox = document.getElementById(`group${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);

    zone.groups[groupName].forEach(obj => {
        const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(obj.id)}`);
        if (groupCheckbox.checked) {
            objectCheckbox.checked = true;
            myMap.geoObjects.add(obj.placemark);
        } else {
            objectCheckbox.checked = false;
            myMap.geoObjects.remove(obj.placemark);
        }
    });
}

function toggleObject(zoneName, groupName, objectId) {
    const zone = zones[zoneName];
    const object = zone.groups[groupName].find(obj => obj.id === objectId);
    const objectCheckbox = document.getElementById(`object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(objectId)}`);

    if (objectCheckbox && objectCheckbox.checked) {
        myMap.geoObjects.add(object.placemark);
    } else if (objectCheckbox) {
        myMap.geoObjects.remove(object.placemark);
    }
}

// Функция для отображения popup с изображением
function showPopup(imageUrl) {
    // Создаем контейнер для popup
    const popupOverlay = document.createElement('div');
    popupOverlay.classList.add('popup-overlay');

    // Контейнер для изображения и крестика
    popupOverlay.innerHTML = `
        <div class="popup-content">
            <span class="popup-close">×</span>
            <img src="${imageUrl}" alt="Image" class="popup-image">
        </div>
    `;

    // Добавляем обработчик клика по крестику
    popupOverlay.querySelector('.popup-close').addEventListener('click', closePopup);

    // Добавляем обработчик клика по overlay для закрытия popup
    popupOverlay.addEventListener('click', (event) => {
        if (event.target === popupOverlay) {
            closePopup();
        }
    });

    // Добавляем popup в body
    document.body.appendChild(popupOverlay);
}

function closePopup() {
    const popupOverlay = document.querySelector('.popup-overlay');
    if (popupOverlay) {
        popupOverlay.remove();
    }
}

// CSS для popup
const css = `
    .popup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }

    .popup-content {
        position: relative;
    }

    .popup-image {
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
    }

    .popup-close {
        position: absolute;
        top: -10px;
        right: -10px;
        background-color: #fff;
        border-radius: 50%;
        padding: 5px 10px;
        cursor: pointer;
        font-size: 24px;
    }
`;
const style = document.createElement('style');
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

// Определение функции generateZoneHTML
function generateZoneHTML(zoneName, color) {
    const controls = document.getElementById('controls');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'section';
    zoneDiv.id = `zone-section-${sanitizeId(zoneName)}`;
    zoneDiv.innerHTML = `
        <label class="zone-label">
            <input type="checkbox" id="zone${sanitizeId(zoneName)}">
            <span class="zone-title">Зона ${zoneName}</span>
        </label>
    `;
    controls.appendChild(zoneDiv);
}

// Определение функции generateGroupHTML
function generateGroupHTML(zoneName, groupName) {
    const section = document.getElementById(`zone-section-${sanitizeId(zoneName)}`);
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <label class="category-label">
            <input type="checkbox" id="group${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
            <span class="category-title">${groupName}</span>
        </label>
        <div class="object-list" id="objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}">
        </div>
    `;
    section.appendChild(groupDiv);
}

// Определение функции generateObjectHTML

function generateObjectHTML(zoneName, groupName, objectId, title) {
    const objectList = document.getElementById(`objects-${sanitizeId(zoneName)}-${sanitizeId(groupName)}`);
    const objectLabel = document.createElement('label');
    objectLabel.innerHTML = `
        <input type="checkbox" id="object${sanitizeId(zoneName)}-${sanitizeId(groupName)}-${sanitizeId(objectId)}"> ${title}
    `;
    objectList.appendChild(objectLabel);
}
