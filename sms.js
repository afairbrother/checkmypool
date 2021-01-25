require('dotenv').config();
const puppeteer = require('puppeteer');
const format = require('date-fns/format');
const schedule = require('node-schedule');
const constants = require('./constants');

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.ACCESS_TOKEN;
const client = require('twilio')(accountSid, authToken);

let availableDates = [];

function formatDateArray(dates) {
    const formattedDates = dates.map((date) => {
        let isoDate = new Date(date.replace(/-/g, '\/').replace(/T.+/, ''))
        return format(isoDate, "E, LLL dd")
    });

    return formattedDates;
}

async function getReservationDates() {
    console.log(`Checking ${constants.poolList[0].name} on a schedule`);
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 3000 });
    
    await page.goto(constants.poolList[0].url, {
        waitUntil: 'networkidle0',
    });
    await page.waitForSelector('.picker');

    await page.click('input[aria-label*="Single" i],input[aria-label*="Solo" i]');
    
    console.log('getting bookable dates...');
    await page.waitForTimeout(3000);
    availableDates = await page.evaluate(() => 
        Array.from(document.querySelectorAll('[title*="Times available"]')).map(date => date.getAttribute('data-value'))
    );
    
    console.log('there are available times on these dates: ', formatDateArray(availableDates));
}

function buildFormattedMessage() {
    let bodyMessage = 'There are new pool times open on ';
    formatDateArray(availableDates).forEach((date) => {
        bodyMessage += date + ' ';
    });
    bodyMessage += `${constants.poolList[0].url}`;

    return bodyMessage;
}

(async() => {
    console.log('initializing and reporting on :02');
    schedule.scheduleJob('02 * * * *', async function(){
        await getReservationDates();
        if(availableDates.length > 0) {
            const bodyString = buildFormattedMessage();
            client.messages
                .create({
                    body: bodyString,
                    from: process.env.TWILIO_NUMBER,
                    to: process.env.USER_NUMBER
                })
                .then(message => console.log(message.sid));
        }
    });
})();