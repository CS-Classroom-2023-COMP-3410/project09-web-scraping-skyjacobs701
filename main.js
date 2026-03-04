const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Part 1 DU Bulletin
axios.get('https://bulletin.du.edu/undergraduate/majorsminorscoursedescriptions/traditionalbachelorsprogrammajorandminors/computerscience/#coursedescriptionstext')
    .then(response => {
        const $ = cheerio.load(response.data);

        const courses = [];
        $('.courseblock').each((i, elem) => {
            const titleText = $(elem).find('.courseblocktitle').text().trim();
            const descText = $(elem).find('.courseblockdesc').text().trim().toLowerCase();

            const match = titleText.match(/COMP\s+(\d{4})\s+(.+?)\s+\(/);
            if (match) {
                const courseNumber = parseInt(match[1], 10);
                const courseCode = `COMP-${match[1]}`;
                const courseTitle = match[2].trim();

                if (courseNumber >= 3000 && !descText.includes('prerequisite')) {
                    courses.push({course: courseCode, title: courseTitle
                    });
                }
            }
        });

        const result = {courses};
        const resultsDir = path.join(__dirname, 'results');

        fs.writeFileSync(path.join(resultsDir, 'bulletin.json'), JSON.stringify(result, null, 4));

        console.log("Saved bulletin.json at: " + path.join(resultsDir, 'bulletin.json'));
    })
    .catch(error => {
        console.error('Error fetching and parsing the page:', error);
    });

// Part 2 Atheltic Events
axios.get('https://denverpioneers.com/index.aspx')
    .then(response => {
        const $ = cheerio.load(response.data);

        const scriptTag = $('script')
            .filter((i, el) => {
                const html = $(el).html();
                return html && html.includes('var obj =') && html.includes('"type":"events"');
            }).first().html();

        if (!scriptTag) {
            console.log("Could not find events script.");
            return;
        }

        const match = scriptTag.match(/var obj = ({[\s\S]*?});/);

        if (!match) {
            console.log("Could not extract obj.");
            return;
        }

        const obj = Function('"use strict";return (' + match[1] + ')')();
        const events = [];
        const athleticEvents = obj.data || [];

        athleticEvents.forEach(event => {
            let opponent = '';

            // I know I technically just need whatever the opponent's name says but it was really bugging me seeing stuff like
            // "Round 2" or a seed number in the opponent name
            // If there wasn't an actual opponent name, I replaced it with the tournamenet name (i.e. the women's golf 
            // invitational) and if there was a seed or rank I got rid of it
            // I know, I'm picky
            
            if (event.opponent && !event.opponent.title.includes("Round") && !event.opponent.title.includes("Finals") && !event.opponent.title.includes("Semifinals") && !event.opponent.title.includes("Quarterfinals")) {
                opponent = event.opponent.title;
            }
            else {
                opponent = event.tournament;
            }

            opponent = opponent.replace(/^#\d+\s*/, '');
            opponent = opponent.replace(/^\(\d+\)\s*/, '');
            opponent = opponent.trim();

            events.push({
                duTeam: event.sport.title,
                opponent: opponent,
                date: event.date
            });
        });

        const result = { events };
        const resultsDir = path.join(__dirname, 'results');
        if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);

        fs.writeFileSync(path.join(resultsDir, 'athletic_events.json'), JSON.stringify(result, null, 4));

        console.log("Saved athletic_events.json at: " + path.join(resultsDir, 'athletic_events.json'));
    })
    .catch(error => {
        console.error('Error fetching DU Athletics page:', error);
    });

// Part 3 Calendar Events

// We were told in class that the description was not required
// We were also told that we didn't need to do the date range but I still chose to
// I also sorted them in order of date because of course I did
const resultsDir = path.join(__dirname, 'results');

const months = [
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12'
];

const events = [];
let completedRequests = 0;

months.forEach(month => {
    const startDate = `2025-${month}-01`;
    const endDate = `2025-${month}-31`;

    const url = `https://www.du.edu/calendar?start_date=${startDate}&end_date=${endDate}#events-listing-date-filter-anchor`;

    axios.get(url)
        .then(response => {
            const $ = cheerio.load(response.data);

            $('.events-listing__item').each((i, elem) => {
                const title = $(elem).find('h3').text().trim();
                const dateText = $(elem).find('p').first().text().trim();
                const timeText = $(elem).find('p').eq(1).text().trim();

                const eventData = { title, date: dateText };
                if (timeText && !timeText.toLowerCase().includes('location')) {
                    eventData.time = timeText;
                }

                events.push(eventData);
            });

            completedRequests++;

            if (completedRequests === months.length) {
                events.sort((a, b) => {
                    const dateA = new Date(a.date + " 2025");
                    const dateB = new Date(b.date + " 2025");
                    return dateA - dateB;
                });

                const result = { events };
                fs.writeFileSync(
                    path.join(resultsDir, 'calendar_events.json'),
                    JSON.stringify(result, null, 4)
                );
                console.log('Saved calendar_events.json at:', path.join(resultsDir, 'calendar_events.json'));
            }
        })
        .catch(error => {
            console.error('Error fetching DU Calendar page:', error);
            completedRequests++;
        });
});