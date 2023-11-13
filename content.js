console.log('HWM GN Bot');
//chrome.storage.local.clear(); // очистка storage

const NAME = 'Cyber';             // имя игрока
const ID = 7242663;               // ID игрока
const OA = 11;                    // требуемый мин оа на уровне
const SLOT = 1;                   // cохранённый комплект в инвентаре, который будет надеваться после разбойников или если недостаточно ОА для боя
const DELAY = 12;                 // интервал проверки ГН (секунды)
const HOME_ID = 2;                // ID "домашнего" сектора для возвращения в ГН
const HOME_NAME = 'East River';   // название "домашнего" сектора
const COSTS = 75;                 // средняя стоимость одного боя исходя из комплекта мин оа (для подсчета расходов)

// Максимальные уровни заданий
const ZAG_LVL = 14;     // заговорщики
const ZAH_LVL = 13;     // захватчики
const RAZ_LVL = 13;     // разбойники
const MON_LVL = 4;      // монстры
const NAB_LVL = 4;      // набеги
const ARM_LVL = 13;     // армии


const DATA = document.body.innerHTML;
const INIT = {
    earn: [],       // список наград
    task: '',       // текущее задание
    r_state: null   // стадии выполнения разбойников
};


const testURL = reg => reg.test(location.href);

const skipTask = () => document.querySelector('a[href*="skip"]').click();

const updateLog = (reward, costs, task) => chrome.storage.local.get(INIT, s => {
    s.earn.push({ reward, costs, task });
    chrome.storage.local.set({ earn: s.earn, task: '' });
});


chrome.storage.local.get(INIT, s => {
    let gold = 0, elements = 0, total_cost = 0;

    s.earn.forEach(earn => {
        gold += Number(/([\d-]+)/.exec(earn.reward)[1]);
        elements += [...earn.reward.matchAll(/(?:,)/g)].flat().length;
        total_cost += earn.costs * COSTS;
    });

    console.log(`Всего золота получено: ${gold}\nРасход на арты примерно: ${total_cost}\nЧистый доход: ${gold - total_cost} + ${elements} элементов\n\nТекущее задание: %c ${s.task}`, 'color:blue');
    console.table(s.earn);
});


// страница ГН
if (testURL(/mercenary/)) {

    // Если есть задания
    if (/заговорщики|разбойники|монстр|набеги|захватчики|Армия/.test(DATA)) {

        // Если задание еще не принято
        if (/=accept/.test(DATA)) {

            let b = document.querySelectorAll('b');
            let arr_tasks = [];
            let arr_gold = [...DATA.matchAll(/(\d+)<\/b> з/g)].flatMap(i => Number(i[1]));

            for (let i = 0; i < b.length; i++) {

                let txt = b[i].textContent;
                // добавляем подходящие задания (элементы) в массив
                if ((/заговорщики \{(\d+)\}/.test(txt) && Number(RegExp.$1) <= ZAG_LVL) ||
                    (/захватчики \{(\d+)\}/.test(txt) && Number(RegExp.$1) <= ZAH_LVL) ||
                    (/разбойники \{(\d+)\}/.test(txt) && Number(RegExp.$1) <= RAZ_LVL) ||
                    (/монстр \{(\d+)\}/.test(txt) && Number(RegExp.$1) <= MON_LVL) ||
                    (/набеги \{(\d+)\}/.test(txt) && Number(RegExp.$1) <= NAB_LVL) ||
                    (/Армия.+\{(\d+)\}/.test(txt) && Number(RegExp.$1) <= ARM_LVL)) arr_tasks.push(b[i]);
            }

            if (arr_tasks.length > 0) {

                let el = arr_tasks[0];

                if (arr_tasks.length == 2) {

                    let index = arr_gold.indexOf(Math.max(...arr_gold)); // ищем наибольшую награду за задание, если 2 варианта
                    el = arr_tasks[index];
                }

                chrome.storage.local.set({ task: el.textContent }); // сохраняем текущее задание

                // Находим ссылку принятия задания
                while (el.nodeName != 'CENTER') {
                    el = el.nextElementSibling;
                }

                el.firstChild.click();

            } else {

                skipTask();

            }

        } else {

            chrome.storage.local.get(INIT, s => {

                if (/разбойники/.test(s.task)) {
                    let sector = /sector.php\?id=(\d+)/.exec(DATA)[1];
                    chrome.storage.local.set({ r_state: sector }); // сохраняем сектор перехода
                    location = 'inventory.php?all_off=100'; // снимаем все арты при задании разбойников

                } else {
                    // задание принято - отправляемся в сектор
                    let move = document.querySelector('a[href*="move"]');
                    move.click();
                }
            });

        }

    } else if (/получаете ([а-яё0-9, ]+)/i.test(DATA)) {

        let reward = RegExp.$1;

        chrome.storage.local.get(INIT, s => {

            let costs = /разбойники/.test(s.task) ? 0 : 1;

            // Получаем награду 
            updateLog(reward, costs, s.task);
            setTimeout(() => location.reload(), 1000);

        });

    } else if (/Приходи через/.test(DATA)) {

        // Заданий пока нет - ждём
        setTimeout(() => location.reload(), DELAY * 1000);

        // быстрый поиск задания за 100 золота
        // updateLog('-100 золота', 0, 'Быстрый поиск нового задания');
        // location = 'mercenary_guild.php?action=instant_merc&gold_price=100&sign=0de25849251f75f4b0fdca49f8e60156';

    } else {

        // Подходящих заданий нет - скипаем
        skipTask();
    }


} else if (testURL(/map.php/)) {    // Действия на карте

    if (/accept_merc/.test(DATA)) {
        // Вступаем в бой или отдаём груз

        chrome.storage.local.set({ r_state: null });

        const link = document.querySelector('div[onclick*="accept_merc"]') || document.querySelector('a[href*="accept_merc"]');
        link.click();

    } else if (/Вам нужно/.test(DATA)) {
        // Восстанавливаем здоровье
        location = 'tavern.php?action=drinkrb';

    } else if (/не можете|не хватает/.test(DATA)) {
        // Не хватает артов - пробуем одеть мин оа
        location = `inventory.php?all_on=${SLOT}`;

    } else if (RegExp(HOME_NAME).test(DATA)) {
        // По прибытии переходим на страницу ГН
        location = 'mercenary_guild.php';

    } else if (/время пути/.test(DATA) == false) {
        // После разбойников, отдали груз и отправляемся обратно
        location = `move_sector.php?id=${HOME_ID}`;
    }

} else if (testURL(/war.php/)) {

    // Проводим бой
    let warid = /warid=(\d+)/.exec(location.href)[1];

    chrome.storage.local.get(INIT, async s => {

        const response = await fetch(`battle.php?warid=${warid}&showinsertion=1&pl_id=${ID}`); // получаем существ с поля боя со всеми параметрами
        const data = await response.text();

        const reg = /\d{9}(\d{3})[\d.]+(\d)/g; // вычленяем id и уровень существа

        let insertion = /s\|([\d#^]+)/.exec(document.body.innerHTML)[1]; // берем строку вставки со страницы

        // проходимся по всем полученным уровням и подменяем на id в строке вставки
        while (reg.exec(data)) {
            if (RegExp.$1 == '000') break;
            else {
                insertion = insertion.replace(RegExp(`^${RegExp.$2}#`), `${+RegExp.$1}#`).replace(RegExp(`\\^${RegExp.$2}#`, 'g'), `^${+RegExp.$1}#`)
            }
        }

        insertion = insertion.replace(/\^|#/g,'|');

        // запуск боя с расстановкой
        await fetch(`battle.php?warid=${warid}&showinsertion=1&setinsertion=${insertion}&pl_id=${ID}&lastturn=-1&lastmess=0&lastmess2=0&lastdata=0`);

        // переключаемся на автобой
        await fetch(`battle.php?pl_id=${ID}&warid=${warid}&fastbattle=1&fastbattlestop=0`);

        let timer = setInterval(async () => {

            let status = await fetch(`battle.php?warid=${warid}&lastturn=-1`);
            let response = await status.text();

            if (/Победившая/.test(response)) {

                // Если бой проигран
                if (RegExp(`Defeated.+>${NAME}`).test(response)) {
                    let costs = /разбойники/.test(s.task) ? 0 : 1;
                    updateLog("0 золота (проиграно)", costs, s.task);
                }

                // Бой закончен - оптравляемся в Fairy Trees или выходим на карту
                clearInterval(timer);

                if (/разбойники/.test(s.task)) {
                    location = 'map.php';
                } else {
                    location = `move_sector.php?id=${HOME_ID}`;
                }
            }

        }, 2000);

    });

} else if (testURL(/inventory/)) {

    if (RegExp(`&nbsp;${OA}`).test(DATA)) location = 'map.php'; // если мин оа удалось надеть после разбойников, то выходим на карту

    // после снятия артов двигаемся в нужный сектор
    chrome.storage.local.get(INIT, s => {
        if (s.r_state) {
            location = `move_sector.php?id=${s.r_state}`;
        }
    });

} else if (testURL(/tavern/)) {

    // После восстановления здоровья переходим на карту
    location = 'map.php';
}