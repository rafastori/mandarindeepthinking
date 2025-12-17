
const fs = require('fs');
const path = 'c:\\Projetos\\mandarindeepthinking\\views\\PolyQuestView\\rules.ts';

try {
    const content = fs.readFileSync(path, 'utf8');
    console.log('Total length:', content.length);
    const lastChars = content.slice(-20);
    console.log('Last 20 chars:', JSON.stringify(lastChars));
    console.log('Last char code:', content.charCodeAt(content.length - 1));

    // Check for backticks
    const backticks = [];
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '`') {
            backticks.push(i);
        }
    }
    console.log('Backtick indices:', backticks);

} catch (err) {
    console.error(err);
}
