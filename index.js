const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')();
const format = require('date-fns/format');
const open = require('open');

const constants = require('./constants');

let availableDates = [];
let poolIndex = 0;
let browser, page;

function formatDateArray(dates) {
    const formattedDates = dates.map((date) => {
        let isoDate = new Date(date.replace(/-/g, '\/').replace(/T.+/, ''))
        return format(isoDate, "E, LLL dd")
    });

    return formattedDates;
}


async function getReservationDates() {
    console.log(`checking ${constants.poolList[poolIndex].name}`);
    browser = await puppeteer.launch();
    page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 3000 });
    
    await page.goto(constants.poolList[poolIndex].url, {
        waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.picker');

    await page.click('input[aria-label*="Single" i],input[aria-label*="Solo" i]');
    
    console.log('getting bookable dates...');

    const needsToClickNextMonth = await page.evaluate(() => {
        return !!document.querySelector('.navigator[data-disabled="false"');
    });

    if(needsToClickNextMonth) {
        await page.click('.navigator[data-disabled="false"');
    }

    await page.waitForTimeout(3000);
    availableDates = await page.evaluate(() => 
        Array.from(document.querySelectorAll('[title*="Times available"]')).map(date => date.getAttribute('data-value'))
    );
    
    console.log('there are available times on these dates: ', formatDateArray(availableDates));
}

async function goToNextPool() {
    if(poolIndex === constants.poolList.length - 1) {
        // end of list, exit tool
        process.exit();
    } else {
        poolIndex++;
        await getReservationDates();
    }
}

(async() => {
    // first time through
    await getReservationDates();

    while(poolIndex < constants.poolList.length) {
        if(availableDates.length > 0) {
            const selectedDate = prompt('which date? -- "next" for next pool ');
            if(selectedDate === 'next') {
                await goToNextPool();
            } else {
                console.log('looking up available times...');
                await page.click(`[data-value="${availableDates[selectedDate]}"]`);

                const availableTimes = await page.evaluate(() => 
                    Array.from(document.querySelectorAll('.timePicker li label span')).map(time => time.innerText)
                );

                console.log('these are the available times: ', availableTimes);
                
                const bookIntent = prompt('Do you want to book any of these times? (y/n) -- (next for next pool) ');

                if(bookIntent === 'y') {
                    console.log('opening a browser window');
                    await open(constants.poolList[poolIndex].url);
                    // assume booking, close process
                    process.exit();
                } else if (bookIntent === 'next') {
                    await goToNextPool();
                }
            }
        } else {
            poolIndex++;
            await getReservationDates();
        }
    }

    process.exit();
})();