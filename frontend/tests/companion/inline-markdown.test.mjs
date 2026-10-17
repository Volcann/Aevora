import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const {parseInlineTokens: parse, safeMarkdownHref: href} = await import(pathToFileURL(process.env.AEVORA_MD_MODULE));
const text = value => ({kind:'text',text:value});
const strong = value => ({kind:'strong',children:[text(value)]});
const flatten = tokens => tokens.map(t => 'text' in t ? t.text : flatten(t.children)).join('');
test('asterisk and underscore bold use semantic strong tokens',()=>{
  for(const marker of ['**','__'])assert.deepEqual(parse(`${marker}Read this${marker}`),[strong('Read this')]);
});
test('bold remains inline with adjacent prose and punctuation',()=>assert.deepEqual(parse('A **bold** choice.'),[text('A '),strong('bold'),text(' choice.')]));
test('triple emphasis nests italic inside bold',()=>assert.deepEqual(parse('***clear***'),[{kind:'strong',children:[{kind:'em',children:[text('clear')]}]}]));
test('italic and code can appear inside bold',()=>{
 assert.deepEqual(parse('**Use `code` and *care***'),[{kind:'strong',children:[text('Use '),{kind:'code',text:'code'},text(' and '),{kind:'em',children:[text('care')]}]}]);
});
test('code spans preserve literal emphasis markers',()=>assert.deepEqual(parse('`**not bold**`'),[{kind:'code',text:'**not bold**'}]));
test('backslash escapes render literal markers',()=>assert.deepEqual(parse('\\*\\*literal\\*\\*'),[text('**literal**')]));
test('ordinary identifiers and multiplication are not emphasis',()=>{
 for(const source of ['snake_case_identifier','one__two__three','2 * 3','a ~ b'])assert.deepEqual(parse(source),[text(source)]);
});
test('unmatched markers in completed replies remain literal',()=>{
 for(const source of ['**not closed','__not closed','A **'])assert.deepEqual(parse(source),[text(source)]);
});
test('streamed opening marker never flashes as empty italic',()=>assert.deepEqual(parse('**',true),[{kind:'strong',children:[]} ]));
test('partial streaming bold is readable before the closing marker arrives',()=>assert.deepEqual(parse('**Think',true),[strong('Think')]));
test('closing delimiter split across frames is not shown to the reader',()=>{
 assert.deepEqual(parse('**Ready*',true),[strong('Ready')]);assert.deepEqual(parse('**Ready**',true),[strong('Ready')]);
});
test('char-by-char streaming preserves all words and final formatting',()=>{
 const source='Start **important** then __clear__.';
 for(let i=1;i<=source.length;i++)assert.ok(Array.isArray(parse(source.slice(0,i),true)));
 assert.equal(flatten(parse(source)),'Start important then clear.');
});
test('link labels can contain bold with balanced URL parentheses',()=>{
 assert.deepEqual(parse('[**Docs**](https://example.test/a_(b))'),[{kind:'link',href:'https://example.test/a_(b)',children:[strong('Docs')]}]);
});
test('script/data/vbscript/file links cannot become actionable links',()=>{
 for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,hi','vbscript:alert(1)','file:///etc/passwd','java\nscript:alert(1)'])assert.equal(href(url),null);
 assert.deepEqual(parse('[unsafe](javascript:alert(1))'),[text('unsafe')]);
});
test('HTTPS, mail and relative workspace links stay usable',()=>{
 for(const url of ['https://example.test','http://localhost:3000','mailto:a@example.test','/settings','../notes','#heading'])assert.equal(href(url),url);
});
test('HTML is kept as text, never converted to markup tokens',()=>assert.deepEqual(parse('<img src=x onerror=alert(1)>'),[text('<img src=x onerror=alert(1)>')]));
test('input is never modified by presentation parsing',()=>{
 const raw='One **bold** `**literal**` word';parse(raw,true);assert.equal(raw,'One **bold** `**literal**` word');
});
test('long output remains bounded and preserves text',()=>{
 const raw='A **clear** point. '.repeat(2500);assert.equal(flatten(parse(raw)),'A clear point. '.repeat(2500));
});
