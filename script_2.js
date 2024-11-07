ymaps.ready(init);

let myMap;
let zones = {}; // Зоны (полигоны)
let objects = {}; // Объекты (маркеры)

function init() {
    myMap = new ymaps.Map("map", {
        center: [59.93, 30.31], // Санкт-Петербург
        zoom: 10
    });

    // Создаем зоны, группы и объекты без добавления их на карту
    createZone(1, [
        [59.90, 30.20],
        [59.96, 30.20],
        [59.96, 30.40],
        [59.90, 30.40],
        [59.90, 30.20]
    ], '#FFA50088', [
        { group: 'playgrounds', objects: [
            [59.92, 30.30],
            [59.94, 30.32],
            [59.95, 30.28]
        ]},
        { group: 'roadwork', objects: [
            [59.94, 30.37],
            [59.95, 30.35],
            [59.96, 30.39]
        ]}
    ]);

    createZone(2, [
        [59.85, 30.10],
        [59.91, 30.10],
        [59.91, 30.30],
        [59.85, 30.30],
        [59.85, 30.10]
    ], '#4682B488', [
        { group: 'playgrounds', objects: [
            [59.88, 30.19],
            [59.90, 30.22],
            [59.89, 30.18]
        ]},
        { group: 'roadwork', objects: [
            [59.89, 30.23],
            [59.90, 30.27],
            [59.89, 30.24]
        ]}
    ]);

    // Добавляем функционал для кнопки скрытия настроек
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

// Функция для создания зон с группами и объектами
function createZone(zoneId, coordinates, color, groupData) {
    // Создаем зону
    let zone = new ymaps.Polygon([coordinates], {
        hintContent: `Зона ${zoneId}`
    }, {
        fillColor: color,
        strokeColor: '#333',
        opacity: 0.4
    });
    zones[zoneId] = { polygon: zone, groups: {} };

    // Создаем объекты в группах
    groupData.forEach((group) => {
        zones[zoneId].groups[group.group] = [];
        group.objects.forEach((coords, index) => {
            const objectNumber = index + 1;
            let name = '';
            if (group.group === 'playgrounds') {
                name = `Детская площадка ${objectNumber}`;
            } else {
                name = `Ремонт дороги ${objectNumber}`;
            }

            // Добавляем ссылку "ссылка"
            let balloonContent = `${name}<br><a href="https://ya.ru" target="_blank">ссылка</a>`;

            let placemark = new ymaps.Placemark(coords, {
                balloonContent: balloonContent
            }, {
                preset: 'islands#blueDotIcon'
            });
            const objectKey = `${zoneId}-${group.group}-${objectNumber}`;
            objects[objectKey] = placemark;
            zones[zoneId].groups[group.group].push(placemark);
        });
    });
}

// Функции для управления видимостью зон, групп и объектов
function toggleZone(zoneId) {
    const zone = zones[zoneId];
    const zoneCheckbox = document.getElementById(`zone${zoneId}`);

    if (zoneCheckbox.checked) {
        myMap.geoObjects.add(zone.polygon);
        // Проверяем, какие группы выбраны, и отображаем их объекты
        for (let groupName in zone.groups) {
            const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);
            if (groupCheckbox && groupCheckbox.checked) {
                zone.groups[groupName].forEach((object, index) => {
                    myMap.geoObjects.add(object);
                    // Отмечаем чекбоксы объектов
                    const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${index + 1}`);
                    if (objectCheckbox) {
                        objectCheckbox.checked = true;
                    }
                });
            }
        }
    } else {
        myMap.geoObjects.remove(zone.polygon);
        // Скрываем все объекты в зоне и сбрасываем чекбоксы групп и объектов
        for (let groupName in zone.groups) {
            zone.groups[groupName].forEach((object, index) => {
                myMap.geoObjects.remove(object);
                const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${index + 1}`);
                if (objectCheckbox) {
                    objectCheckbox.checked = false;
                }
            });
            const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);
            if (groupCheckbox) {
                groupCheckbox.checked = false;
            }
        }
    }
}

function toggleGroup(zoneId, groupName) {
    const zone = zones[zoneId];
    const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);
    const zoneCheckbox = document.getElementById(`zone${zoneId}`);

    if (!zoneCheckbox.checked) {
        // Автоматически выбираем зону, если она не выбрана
        zoneCheckbox.checked = true;
        myMap.geoObjects.add(zone.polygon);
    }

    if (groupCheckbox.checked) {
        zone.groups[groupName].forEach((object, index) => {
            myMap.geoObjects.add(object);
            // Отмечаем чекбоксы объектов
            const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${index + 1}`);
            if (objectCheckbox) {
                objectCheckbox.checked = true;
            }
        });
    } else {
        zone.groups[groupName].forEach((object, index) => {
            myMap.geoObjects.remove(object);
            // Сбрасываем чекбоксы объектов
            const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${index + 1}`);
            if (objectCheckbox) {
                objectCheckbox.checked = false;
            }
        });
    }
}

function toggleObject(zoneId, groupName, objectId) {
    const objectKey = `${zoneId}-${groupName}-${objectId}`;
    const object = objects[objectKey];
    const objectCheckbox = document.getElementById(`object${zoneId}-${groupName}-${objectId}`);
    const zoneCheckbox = document.getElementById(`zone${zoneId}`);
    const groupCheckbox = document.getElementById(`group${zoneId}-${groupName}`);

    if (!zoneCheckbox.checked) {
        // Автоматически выбираем зону
        zoneCheckbox.checked = true;
        myMap.geoObjects.add(zones[zoneId].polygon);
    }

    if (!groupCheckbox.checked) {
        // Автоматически выбираем группу
        groupCheckbox.checked = true;
    }

    if (objectCheckbox.checked) {
        myMap.geoObjects.add(object);
    } else {
        myMap.geoObjects.remove(object);
    }


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
