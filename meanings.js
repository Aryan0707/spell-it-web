// Word meanings for the study card: part of speech, a plain-English definition and a few
// related words, for every built-in word. Richer than the one-line `hint` in WORD_LIST,
// which is still what the recall-stage hints and custom/AI words use.
//
// Row format:  "part of speech | definition | related, words (optional)"
//  - Definitions use simple words and never contain the word itself.
//  - They must not contain a US-only or UK-only spelling (color/colour, center/centre...):
//    the app shows both styles, and only the headword is switched.
//  - Keyed by the US spelling; British variants resolve through WORD_LIST.variants.
(() => {
  "use strict";

  const ROWS = {
    // ---------- beginner ----------
    cat: "noun | A small furry animal that people keep as a pet. It purrs and meows. | kitten",
    dog: "noun | A common pet animal that barks and is often kept as a companion. | puppy, hound",
    sun: "noun | The star that gives the Earth its light and heat. | sunshine, daylight",
    run: "verb | To move quickly on foot; also to manage or operate something. | sprint, jog",
    jump: "verb | To push yourself off the ground into the air. | leap, hop",
    frog: "noun | A small animal with long back legs that lives near water and hops. | toad",
    milk: "noun | A white liquid from cows that people drink and use in food. | dairy",
    book: "noun | Pages joined together inside a cover, for reading or writing in. | novel, volume",
    happy: "adjective | Feeling joy or pleasure. | glad, cheerful, joyful",
    apple: "noun | A round, crisp fruit with red, green or yellow skin. | fruit",
    house: "noun | A building where a family lives. | home, residence",
    water: "noun | The clear liquid in rivers and rain that people drink. As a verb, to give it to plants. | liquid",
    green: "adjective | Having the shade of fresh grass and leaves. | emerald, leafy",
    smile: "verb | To turn up the corners of your mouth to show you are happy or friendly. | grin, beam",
    chair: "noun | A seat for one person, with a back. | seat, stool",

    // ---------- everyday ----------
    because: "conjunction | Used to give the reason for something. | since, as",
    friend: "noun | A person you know well and like. | pal, companion",
    believe: "verb | To accept that something is true, or that someone is telling the truth. | trust, accept",
    separate: "verb / adjective | To divide or keep apart; or not joined to anything else. | divide, apart",
    definitely: "adverb | Without any doubt; for sure. | certainly, surely",
    necessary: "adjective | Needed; something you must have or do. | essential, required",
    receive: "verb | To get something that is given or sent to you. | get, accept",
    though: "conjunction | In spite of the fact that. | although, even if",
    beautiful: "adjective | Very pleasing to look at, hear or experience. | lovely, gorgeous",
    science: "noun | The study of nature and the physical world through observation and experiments. | biology, physics",
    people: "noun | Men, women and children; human beings. | persons, public",
    different: "adjective | Not the same as something else. | unlike, distinct",
    favorite: "adjective / noun | Liked more than all the others. | preferred, best-loved",
    weird: "adjective | Strange or unusual in a way that is hard to explain. | odd, strange",
    environment: "noun | The natural world, or the conditions in which people, animals and plants live. | nature, surroundings",
    government: "noun | The group of people who rule a country and make its big decisions. | administration, state",
    restaurant: "noun | A place where you pay to sit down and eat a meal. | cafe, diner",
    calendar: "noun | A chart showing the days, weeks and months of the year. | diary, planner",
    vacuum: "noun / verb | A space with no air in it; also a machine that cleans by sucking up dust. | cleaner",
    rhythm: "noun | A regular, repeated pattern of sounds or beats. | beat, tempo",
    language: "noun | The system of words people use to speak and write. | speech, tongue",
    surprise: "noun / verb | Something unexpected; or to make someone feel astonished. | shock, astonish",
    immediately: "adverb | Right now, without any delay. | at once, instantly",
    occasion: "noun | A particular time, or a special event. | event, celebration",
    embarrass: "verb | To make someone feel shy, awkward or ashamed. | shame, humiliate",
    knowledge: "noun | The facts and skills you have learned. | learning, understanding",
    guarantee: "noun / verb | A promise that something will be done or will happen. | promise, assure",
    mischievous: "adjective | Playful in a way that causes small amounts of trouble. | naughty, playful",
    neighbor: "noun | A person who lives next door or very near to you. | resident",
    achieve: "verb | To succeed in reaching a goal through effort. | accomplish, attain",
    although: "conjunction | In spite of the fact that. | though, even though",
    business: "noun | Work done to earn money, or a company that does it. | company, trade",
    column: "noun | A tall upright pillar; or a vertical line of numbers or text. | pillar, post",
    foreign: "adjective | From or belonging to another country. | overseas, alien",
    grateful: "adjective | Feeling thankful for something someone has done. | thankful, appreciative",
    height: "noun | How tall a person or thing is. | tallness, altitude",
    island: "noun | A piece of land completely surrounded by water. | isle",
    jewelry: "noun | Decorations such as rings and necklaces that people wear. | gems, ornaments",
    library: "noun | A place where books are kept for people to read or borrow. | archive",
    medicine: "noun | A drug you take to treat an illness; also the science of treating illness. | drug, remedy",
    opposite: "adjective / preposition | Completely different; or facing something from across. | reverse, contrary",
    possible: "adjective | Able to happen or to be done. | achievable, feasible",
    question: "noun / verb | A sentence you ask to get information; or to doubt something. | query, inquiry",
    rhyme: "noun / verb | Words that end with the same sound, such as “cat” and “hat”. | verse, poem",
    schedule: "noun / verb | A plan that lists when things will happen. | timetable, plan",
    tomorrow: "adverb / noun | The day after today. | next day",
    umbrella: "noun | A folding cover you hold over your head to keep off the rain. | parasol",
    vegetable: "noun | A plant, or part of one, that is eaten as food, such as a carrot. | produce",
    weather: "noun | The daily conditions outside, such as sun, rain and wind. | climate",

    // ---------- expert ----------
    conscientious: "adjective | Careful and thorough, taking your duties seriously. | diligent, careful",
    onomatopoeia: "noun | A word that sounds like the thing it names, such as “buzz”. | sound word",
    bureaucracy: "noun | A system with many rules and officials that can make things slow. | red tape, administration",
    questionnaire: "noun | A set of written questions used to gather information. | survey, form",
    entrepreneur: "noun | A person who starts a business and takes financial risks. | businessperson, founder",
    chrysanthemum: "noun | A garden flower with many layered petals. | flower, bloom",
    idiosyncrasy: "noun | A strange or personal habit that makes someone different from others. | quirk, oddity",
    connoisseur: "noun | A person with expert knowledge and taste in a subject such as food or art. | expert, judge",
    camouflage: "noun / verb | Patterns or shades that help something blend into its surroundings. | disguise",
    silhouette: "noun | A dark shape seen against a lighter background. | outline, shadow",
    rhinoceros: "noun | A large, heavy animal with thick skin and one or two horns on its nose. | rhino",
    acquaintance: "noun | A person you know a little but not well. | contact",
    millennium: "noun | A period of one thousand years. | thousand years",
    hierarchy: "noun | A system that ranks people or things from highest to lowest. | ranking, order",
    phenomenon: "noun | An event or fact that can be observed and is remarkable or hard to explain. | event, occurrence",
    pneumonia: "noun | A serious lung illness caused by infection. | lung infection",
    cappuccino: "noun | An Italian coffee with hot, frothy milk on top. | latte",
    kaleidoscope: "noun | A tube with mirrors and bits of glass that makes changing patterns when turned. | pattern",

    // ---------- more beginner ----------
    bird: "noun | An animal with feathers and wings that can usually fly. | creature",
    fish: "noun | An animal that lives in water and breathes through gills. | seafood",
    tree: "noun | A tall plant with a thick trunk, branches and leaves. | plant",
    star: "noun | A bright point of light in the night sky; also a famous performer. | celebrity",
    moon: "noun | The large round object that moves around the Earth and shines at night. | satellite",
    ball: "noun | A round object used in games; also a formal dance party. | sphere",
    cake: "noun | A sweet baked food made from flour, eggs and sugar. | pastry, dessert",
    bike: "noun | A vehicle with two wheels that you ride by pushing pedals. | bicycle, cycle",
    rain: "noun / verb | Water that falls from clouds in drops. | shower, drizzle",
    snow: "noun | Soft white flakes of frozen water that fall from the sky. | frost, sleet",
    shoe: "noun | A strong covering for the foot. | boot, sandal",
    hand: "noun | The part at the end of your arm, with fingers and a thumb. | palm",
    door: "noun | A panel that opens and closes an entrance. | entrance, gate",
    desk: "noun | A table, often with drawers, used for reading and writing. | table, workstation",
    lamp: "noun | A device that gives light. | light",
    picture: "noun | A drawing, painting or photograph. | image, photo",
    another: "determiner | One more; a different one. | additional, other",
    thought: "noun / verb | An idea in your mind; also the past tense of “think”. | idea, notion",
    through: "preposition | From one end or side of something to the other. | across, via",
    careful: "adjective | Paying attention so as to avoid mistakes or danger. | cautious, watchful",
    kitchen: "noun | A room where food is cooked. | galley",
    morning: "noun | The early part of the day, until about noon. | dawn, daybreak",
    evening: "noun | The part of the day between afternoon and night. | dusk, sunset",
    holiday: "noun | A day or period of rest from work or school. | break, time off",
    cousin: "noun | A child of your aunt or uncle. | relative",
    sister: "noun | A girl or woman with the same parents as you. | sibling",
    brother: "noun | A boy or man with the same parents as you. | sibling",
    teacher: "noun | A person whose job is to help others learn. | tutor, instructor",
    student: "noun | A person who is studying at a school or college. | pupil, learner",
    journey: "noun | The act of going from one place to another, usually over a long distance. | trip, voyage",
    hungry: "adjective | Wanting or needing food. | starving, famished",
    thirsty: "adjective | Wanting or needing something to drink. | parched",
    thankful: "adjective | Pleased and grateful for something. | grateful",
    birthday: "noun | The day each year when you celebrate the day you were born. | anniversary",
    remember: "verb | To keep something in your mind or bring it back to mind. | recall, recollect",
    alphabet: "noun | The set of letters used to write a language. | letters",
    computer: "noun | An electronic machine that stores and processes information. | laptop",
    continue: "verb | To keep going, or to start again after a pause. | carry on, proceed",
    decision: "noun | A choice you make after thinking about it. | choice, verdict",
    exercise: "noun / verb | Physical activity that keeps the body healthy; or a task for practice. | workout, training",
    furniture: "noun | Movable things in a room, such as chairs, tables and beds. | furnishings",
    direction: "noun | The way something is moving or facing; or instructions on what to do. | route, course",
    character: "noun | A person in a story; or the qualities that make someone who they are. | personality, role",
    adventure: "noun | An exciting or unusual experience. | quest, journey",
    chocolate: "noun | A sweet food made from roasted cocoa beans. | cocoa, sweet",
    dangerous: "adjective | Likely to cause harm. | risky, unsafe",
    difficult: "adjective | Hard to do or to understand. | hard, tough",
    vacation: "noun | A period of time spent away from home or work for rest or travel. | holiday, break",
    mountain: "noun | A very high hill with steep sides. | peak, summit",
    thousand: "number | The number 1,000. | ",
    hospital: "noun | A place where sick or injured people are treated. | clinic",
    dictionary: "noun | A book or website that explains the meanings of words. | glossary",
    temperature: "noun | How hot or cold something is. | heat",
    disappear: "verb | To go out of sight or stop existing. | vanish, fade",
    disappoint: "verb | To make someone sad by not being as good as they hoped. | let down, upset",
    appreciate: "verb | To value something or be thankful for it. | value, cherish",
    communicate: "verb | To share information, ideas or feelings with others. | talk, convey",
    experience: "noun / verb | Knowledge gained from doing something; or something that happens to you. | skill, event",
    imagination: "noun | The ability to form pictures and ideas in your mind. | creativity, fantasy",
    information: "noun | Facts or details about something. | data, facts",
    personality: "noun | The qualities that make a person who they are. | character, nature",
    professional: "adjective / noun | Done by a person who is trained and paid for the work. | expert, skilled",
    unfortunately: "adverb | Used to say that something is a pity or bad luck. | sadly, regrettably",
    responsibility: "noun | A duty to take care of something or someone. | duty, obligation",
    extraordinary: "adjective | Very unusual or remarkable. | remarkable, amazing",
    conscience: "noun | The inner sense of what is right and wrong. | morals",
    pronunciation: "noun | The way a word is said. | speech, accent",
    miscellaneous: "adjective | Of various kinds that do not belong together. | assorted, mixed",
    unprecedented: "adjective | Never done or known before. | unheard-of, new",
    indispensable: "adjective | So important that you cannot do without it. | essential, vital",
    subconscious: "adjective / noun | Happening in your mind without you being aware of it. | instinctive, hidden",
    exaggerate: "verb | To make something seem bigger or better than it really is. | overstate, inflate",
    maintenance: "noun | The work of keeping something in good condition. | upkeep, repair",
    questionable: "adjective | Doubtful; not clearly honest or good. | doubtful, dubious",
    perseverance: "noun | Continuing to try hard even when things are difficult. | persistence, determination",
    vulnerable: "adjective | Easily hurt or harmed. | exposed, weak",

    // ---------- US / UK spelling pairs ----------
    color: "noun | The look of something such as red, blue or yellow, caused by how it reflects light. | shade, hue",
    honor: "noun / verb | Great respect; or to show respect to someone. | respect, glory",
    flavor: "noun | The taste of a food or drink. | taste, tang",
    humor: "noun | The quality of being funny; the ability to enjoy fun. | comedy, wit",
    labor: "noun | Hard physical work. | toil, work",
    rumor: "noun | A story that people pass on and that may not be true. | gossip, hearsay",
    harbor: "noun | A sheltered area of water where ships stay safe. | port, dock",
    vapor: "noun | A mist or gas made when a liquid is heated. | steam, mist",
    center: "noun | The middle point or part of something. | middle, core",
    theater: "noun | A building where plays are performed. | playhouse, stage",
    meter: "noun | A unit of length in the metric system, equal to 100 cm. | unit",
    liter: "noun | A unit of volume for liquids in the metric system. | unit",
    fiber: "noun | A thin thread of material; also the part of food that helps digestion. | thread, strand",
    organize: "verb | To arrange things in a clear, ordered way. | arrange, sort",
    realize: "verb | To understand or notice something, often suddenly. | notice, understand",
    recognize: "verb | To know someone or something because you have seen it before. | identify, know",
    apologize: "verb | To say you are sorry. | say sorry",
    memorize: "verb | To learn something so you can remember it exactly. | learn by heart",
    catalog: "noun / verb | A list of items, often with descriptions and pictures. | list, directory",
    dialog: "noun | A conversation between two or more people. | conversation, discussion",
    defense: "noun | Action taken to protect against attack. | protection, guard",
    license: "noun | Official permission to do or own something. | permit, certificate",
    traveling: "verb | Going from one place to another. | journeying, touring",
    canceled: "verb | Decided that a planned event will not take place. | called off",
    gray: "adjective | The shade between black and white, like rain clouds. | silver, ash",
    pajamas: "noun | Loose clothes that you wear in bed. | nightclothes",
    mustache: "noun | Hair growing on the upper lip. | whiskers",
    fulfill: "verb | To do or complete what is needed or promised. | achieve, satisfy",

    // ---------- hard ----------
    achievement: "noun | Something good that you have done successfully through effort. | accomplishment, success",
    committee: "noun | A group of people chosen to make decisions or plans for a larger group. | board, panel",
    conscious: "adjective | Awake and aware of what is around you. | aware, awake",
    existence: "noun | The state of being real or alive. | being, life",
    independent: "adjective | Not controlled by others; able to manage on your own. | free, self-reliant",
    occurrence: "noun | Something that happens. | event, incident",
    parallel: "adjective | Running side by side with the same distance between, and never meeting. | alongside, equidistant",
    possession: "noun | Something that you own. | belonging, property",
    privilege: "noun | A special right or benefit that only some people have. | advantage, right",
    recommend: "verb | To suggest that something is good or should be done. | suggest, advise",
    sincerely: "adverb | In a way that is honest and genuine. | truly, honestly",
    cemetery: "noun | A place where dead people are buried. | graveyard",
    handkerchief: "noun | A small piece of cloth used to wipe your nose or face. | tissue",
    sacrilege: "noun | Treating something holy, or greatly respected, without respect. | blasphemy",
    yacht: "noun | A boat with sails or an engine used for pleasure or racing. | sailboat",
    colonel: "noun | A high-ranking officer in the army. | officer",
    accommodate: "verb | To provide space for; or to fit what someone needs. | house, suit",
    acquiesce: "verb | To agree or accept without arguing. | consent, comply",
    liaison: "noun | A link that helps people or groups work together. | contact, connection",
    reminiscence: "noun | The act of remembering past events. | memory, recollection",
    renaissance: "noun | A new growth of interest in art or ideas; also the period in Europe from about the 14th to the 17th century. | revival, rebirth",
    sovereignty: "noun | The power of a country to rule itself. | independence, authority",
    surreptitious: "adjective | Done secretly so that others do not notice. | secret, stealthy",
    unanimous: "adjective | Agreed by everyone, with no one against. | united, undivided",
    vengeance: "noun | Punishment given to someone in return for harm they caused. | revenge",
    whimsical: "adjective | Playful and unusual in a charming way. | playful, fanciful",

    // ---------- more expert ----------
    camaraderie: "noun | Friendship and trust among people who spend time together. | fellowship, friendship",
    gauge: "noun / verb | A tool that measures something; or to judge something. | dial, measure",
    inoculate: "verb | To protect someone from a disease by giving them a vaccine. | vaccinate",
    juxtapose: "verb | To put two things next to each other to show how they differ. | compare, contrast",
    labyrinth: "noun | A complicated network of paths that is hard to find your way through. | maze",
    mnemonic: "noun | A trick or short rhyme that helps you remember something. | memory aid",
    paraphernalia: "noun | Many small items needed for a particular activity. | equipment, gear",
    pharaoh: "noun | A king of ancient Egypt. | ruler",
    supersede: "verb | To take the place of something older or less suitable. | replace, succeed",
    cinnamon: "noun | A sweet brown spice made from tree bark. | spice",
    physician: "noun | A doctor, especially one trained in medicine. | doctor",
    resemblance: "noun | The way two things look alike. | similarity, likeness",
    trustworthy: "adjective | Able to be relied on; honest. | reliable, dependable",
    prestigious: "adjective | Respected and admired because of high status. | respected, esteemed",
  };

  function parse(row) {
    const [pos, definition, related] = row.split("|").map((p) => p.trim());
    return { pos, definition, related: related ? related.split(",").map((r) => r.trim()).filter(Boolean) : [] };
  }

  // Rows that did not come from this file (AI-generated words) are untrusted, so they are checked.
  function fromRow(word, row) {
    if (typeof row !== "string" || row.length > 600) return null;
    const parts = row.split("|").map((p) => p.trim());
    if (parts.length < 2 || parts.length > 3) return null;
    const [pos, definition, related = ""] = parts;
    if (!/^[a-z][a-z /]{1,38}$/i.test(pos)) return null;
    if (definition.length < 12 || definition.length > 300 || /[{}]/.test(definition)) return null;
    if (new RegExp(`\\b${String(word).toLowerCase()}\\b`, "i").test(definition)) return null; // would give the answer away
    const list = related.split(",").map((r) => r.trim()).filter(Boolean);
    if (list.length > 4 || list.some((r) => !/^[a-z][a-z' -]{0,38}$/i.test(r))) return null;
    return { pos, definition, related: list };
  }

  const cache = new Map();

  // Look up by the spelling on screen, which may be the British variant of the base word.
  function get(spelled) {
    if (!spelled) return null;
    const key = String(spelled).toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const list = typeof WORD_LIST !== "undefined" ? WORD_LIST : [];
    const base = list.find((w) => w.word === key || (w.variants && Object.values(w.variants).includes(key)));
    const row = ROWS[base ? base.word : key];
    const meaning = row ? parse(row) : null;
    cache.set(key, meaning);
    return meaning;
  }

  // The built-in, hand-checked meaning wins; a word's own AI-written row is the fallback.
  function forEntry(entry) {
    if (!entry) return null;
    return get(entry.word) || fromRow(entry.word, entry.meaning);
  }

  window.SpellMeanings = { get, fromRow, forEntry, rows: ROWS };
})();
