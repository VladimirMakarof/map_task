const apiKey = 'AIzaSyAxQtm76Gl2s2Yfv8KX7Zwpj3bfgzKZNkg'; 
const spreadsheetId = '13aWpgiOD_uZodKXpxLzkLAgidljTH8UZX3F78czGfwQ';

let myMap;
let zones = {}; // Хранит зоны, группы и объекты

function fetchZoneData(sheetName, zoneId, color) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}?key=${apiKey}`;
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Ошибка при загрузке данных с листа ${sheetName}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const rows = data.values;
            if (!rows) {
                throw new Error(`Данные с листа ${sheetName} пусты или недоступны`);
            }

            // Создаем зону, если она не была создана ранее
            if (!zones[zoneId]) {
                zones[zoneId] = { polygon: null, groups: {} };
            }

            // Создаем контейнеры в HTML для зоны и групп
            generateZoneHTML(zoneId, color);

            // Создаем полигон зоны
            const coordinates = zoneId === 1 ? [[59.90, 30.20], [59.96, 30.20], [59.96, 30.40], [59.90, 30.40], [59.90, 30.20]] : 
                                               [[59.85, 30.10], [59.91, 30.10], [59.91, 30.30], [59.85, 30.30], [59.85, 30.10]];
            zones[zoneId].polygon = new ymaps.Polygon([coordinates], {}, {
                fillColor: color,
                strokeColor: '#333',
                opacity: 0.4
            });

            // Добавляем обработчик на чекбокс зоны
            document.getElementById(`zone${zoneId}`).addEventListener('change', () => toggleZone(zoneId));

            // Обрабатываем данные из таблицы, пропуская заголовок
            for (let i = 1; i < rows.length; i++) {
                const [id, group, title, lat, lon, link, imageUrl] = rows[i];
                const latitude = parseFloat(lat);
                const longitude = parseFloat(lon);

                if (!zones[zoneId].groups[group]) {
                    zones[zoneId].groups[group] = [];
                    generateGroupHTML(zoneId, group);
                }

                const placemark = new ymaps.Placemark(
                    [latitude, longitude],
                    {
                        balloonContent: `
<div>
        <div class="balloon-title">${title}</div>
        <a href="${link}" target="_blank" class="balloon-link">Подробнее</a><br>
        <img src="${imageUrl}" alt="${title}" style="width:200px; cursor:pointer;" onclick="showPopup('${imageUrl}')">
    </div>
                        `
                    },
                    {
                        preset: 'islands#blueDotIcon'
                    }
                );
                zones[zoneId].groups[group].push({ id, placemark });
                generateObjectHTML(zoneId, group, id, title);
            }

            // Добавляем обработчики на чекбоксы групп и объектов
            for (let group in zones[zoneId].groups) {
                document.getElementById(`group${zoneId}-${group}`).addEventListener('change', () => toggleGroup(zoneId, group));
                zones[zoneId].groups[group].forEach(obj => {
                    const checkbox = document.getElementById(`object${zoneId}-${group}-${obj.id}`);
                    if (checkbox) {
                        checkbox.addEventListener('change', () => toggleObject(zoneId, group, obj.id));
                    }
                });
            }

        })
        .catch(error => console.error(`Ошибка при загрузке данных с листа ${sheetName}:`, error));
}

ymaps.ready(init);

function init() {
    myMap = new ymaps.Map("map", {
        center: [59.93, 30.31],
        zoom: 10
    });

    fetchZoneData('Sheet1', 1, '#FFA50088');
    fetchZoneData('Sheet2', 2, '#4682B488');

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

function toggleZone(zoneId) {
    const zone = zones[zoneId];
    if (!zone) return;

    const zoneCheckbox = document.getElementById(`zone${zoneId}`);

    if (zoneCheckbox.checked) {
        myMap.geoObjects.add(zone.polygon);
    } else {
        myMap.geoObjects.remove(zone.polygon);
    }

    // Проверка состояния чекбоксов для Зоны 1 и Зоны 2
    const zone1Checked = document.getElementById("zone1").checked;
    const zone2Checked = document.getElementById("zone2").checked;

    if (zone1Checked && zone2Checked) {
        // Если обе зоны выбраны, отцентрировать и настроить масштаб, чтобы охватить обе зоны
        const bounds = [
            [59.85, 30.10], 
            [59.96, 30.40]
        ];
        myMap.setBounds(bounds, { checkZoomRange: true });
    } else if (zone1Checked) {
        // Если выбрана только Зона 1
        myMap.setCenter([59.93, 30.31], 12);
    } else if (zone2Checked) {
        // Если выбрана только Зона 2
        myMap.setCenter([59.88, 30.20], 12);
    }

    // Обновляем состояние групп и объектов внутри зоны
    for (let groupName in zone.groups) {
        const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);
        groupCheckbox.checked = zoneCheckbox.checked;

        zone.groups[groupName].forEach(obj => {
            const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${obj.id}`);
            objectCheckbox.checked = zoneCheckbox.checked;
            if (zoneCheckbox.checked) {
                myMap.geoObjects.add(obj.placemark);
            } else {
                myMap.geoObjects.remove(obj.placemark);
            }
        });
    }
}



function toggleGroup(zoneId, groupName) {
    const zone = zones[zoneId];
    const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);

    zone.groups[groupName].forEach(obj => {
        const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${obj.id}`);
        if (groupCheckbox.checked) {
            objectCheckbox.checked = true;
            myMap.geoObjects.add(obj.placemark);
        } else {
            objectCheckbox.checked = false;
            myMap.geoObjects.remove(obj.placemark);
        }
    });
}

function toggleObject(zoneId, groupName, objectId) {
    const zone = zones[zoneId];
    const object = zone.groups[groupName].find(obj => obj.id === objectId);
    const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${objectId}`);

    if (objectCheckbox.checked) {
        myMap.geoObjects.add(object.placemark);
    } else {
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
            <span class="popup-close" onclick="closePopup()">×</span>
            <img src="${imageUrl}" alt="Image" class="popup-image">
        </div>
    `;

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



// Дополнительный HTML для popup
document.body.insertAdjacentHTML('beforeend', `
    <div id="image-popup" class="popup" onclick="closePopup()">
        <img id="popup-image" src="" alt="Просмотр изображения">
    </div>
`);

// CSS для popup
const css = `
    .popup {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .popup img {
        max-width: 90%;
        max-height: 90%;
        border-radius: 8px;
    }
`;
const style = document.createElement('style');
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

// Определение функции generateZoneHTML
function generateZoneHTML(zoneId, color) {
    const controls = document.getElementById('controls');
    const zoneDiv = document.createElement('div');
    zoneDiv.className = 'section';
    zoneDiv.id = `zone-section-${zoneId}`;
    zoneDiv.innerHTML = `
        <label class="zone-label">
            <input type="checkbox" id="zone${zoneId}">
            <span class="zone-title">Зона ${zoneId}</span>
        </label>
    `;
    controls.appendChild(zoneDiv);
}

// Определение функции generateGroupHTML
function generateGroupHTML(zoneId, groupName) {
    const section = document.getElementById(`zone-section-${zoneId}`);
    const groupDiv = document.createElement('div');
    groupDiv.className = 'subsection';
    groupDiv.innerHTML = `
        <label class="category-label">
            <input type="checkbox" id="group${zoneId}-${groupName}">
            <span class="category-title">${groupName}</span>
        </label>
        <div class="object-list" id="objects-${zoneId}-${groupName}">
        </div>
    `;
    section.appendChild(groupDiv);
}

// Определение функции generateObjectHTML
function generateObjectHTML(zoneId, groupName, objectId, title) {
    const objectList = document.getElementById(`objects-${zoneId}-${groupName}`);
    const objectLabel = document.createElement('label');
    objectLabel.innerHTML = `
        <input type="checkbox" id="object${zoneId}-${groupName}-${objectId}"> ${title}
    `;
    objectList.appendChild(objectLabel);
}
