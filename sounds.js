// Sound guide for the pronounce coach: real syllables, a plain-English respelling,
// IPA and (where the spelling hides the sound) a short note, for every built-in word.
//
// Row format:  "written-syl-la-bles | RES-pel-ling | /ipa/ | optional note"
//  - The respelling has one part per written syllable; the STRESSED part is UPPERCASE
//    (single-syllable words are all caps). Parts are spoken aloud by the coach, so they
//    use ordinary English letters (ay, ee, eye, oh, oo, ow, aw, uh, ur, air) that a
//    text-to-speech voice reads correctly, unlike a chunk of the real spelling like "ly".
//  - Pronunciation is General American. Keyed by the US spelling; British variants
//    (colour, favourite...) are resolved through WORD_LIST.variants.
(() => {
  "use strict";

  const ROWS = {
    // ---------- beginner ----------
    cat: "cat | KAT | /kæt/",
    dog: "dog | DAWG | /dɔɡ/",
    sun: "sun | SUN | /sʌn/",
    run: "run | RUN | /rʌn/",
    jump: "jump | JUMP | /dʒʌmp/",
    frog: "frog | FRAWG | /frɔɡ/",
    milk: "milk | MILK | /mɪlk/",
    book: "book | BOOK | /bʊk/ | The double o is short here, like in “look”.",
    happy: "hap-py | HAP-ee | /ˈhæp.i/ | The final y says /ee/.",
    apple: "ap-ple | AP-ul | /ˈæp.əl/ | The ending -le sounds like “ul”.",
    house: "house | HOWS | /haʊs/ | “ou” says /ow/; the final e is silent.",
    water: "wa-ter | WAW-tur | /ˈwɔ.tɚ/ | “a” says /aw/ after w.",
    green: "green | GREEN | /ɡrin/",
    smile: "smile | SMYLE | /smaɪl/ | The final e is silent and makes the i say its name.",
    chair: "chair | CHAIR | /tʃɛr/ | “air” says /air/.",

    // ---------- everyday ----------
    because: "be-cause | bih-KAWZ | /bɪˈkɔz/ | “au” says /aw/ and the ending -se sounds like Z.",
    friend: "friend | FREND | /frɛnd/ | “ie” says a short /e/ here; you don't hear the i.",
    believe: "be-lieve | bih-LEEV | /bɪˈliv/ | “ie” says /ee/; the final e is silent.",
    separate: "sep-a-rate | SEP-uh-rit | /ˈsɛp.ə.rɪt/ | The middle a is a weak “uh”, which is why it is easy to write “seperate”.",
    definitely: "def-i-nite-ly | DEF-uh-nit-lee | /ˈdɛf.ə.nɪt.li/ | The ending sounds like “it”, so the final “ite” is easy to misspell.",
    necessary: "nec-es-sar-y | NES-uh-ser-ee | /ˈnɛs.ə.sɛr.i/ | The /s/ sounds are spelled c, ss: one c, two s.",
    receive: "re-ceive | rih-SEEV | /rɪˈsiv/ | “ei” says /ee/ after c.",
    though: "though | THOH | /ðoʊ/ | “ough” says /oh/; the gh is silent.",
    beautiful: "beau-ti-ful | BYOO-tuh-ful | /ˈbju.tə.fəl/ | “eau” says /yoo/.",
    science: "sci-ence | SY-uns | /ˈsaɪ.əns/ | “sc” sounds like /s/.",
    people: "peo-ple | PEE-pul | /ˈpi.pəl/ | “eo” says /ee/.",
    different: "dif-fer-ent | DIF-ur-unt | /ˈdɪf.ɚ.ənt/ | Double f, then “er” and “ent” are weak.",
    favorite: "fa-vor-ite | FAY-vur-it | /ˈfeɪ.vɚ.ɪt/ | The ending -ite says “it”.",
    weird: "weird | WEERD | /wɪrd/ | “ei” says /ee/: an exception to “i before e”.",
    environment: "en-vi-ron-ment | en-VY-run-munt | /ɪnˈvaɪ.rən.mənt/ | Say the n before the m: envi-RON-ment.",
    government: "gov-ern-ment | GUV-urn-munt | /ˈɡʌv.ɚn.mənt/ | “o” says /u/; the n in “govern” is pronounced.",
    restaurant: "res-tau-rant | RES-tuh-ront | /ˈrɛs.tə.rɑnt/ | The middle “au” is weak: it sounds like “tuh”.",
    calendar: "cal-en-dar | KAL-un-dur | /ˈkæl.ən.dɚ/ | The ending -ar sounds like “er”.",
    vacuum: "vac-u-um | VAK-yoo-um | /ˈvæk.ju.əm/ | Two u's in a row, both pronounced.",
    rhythm: "rhy-thm | RITH-um | /ˈrɪð.əm/ | “rh” is just /r/, and the second syllable has no vowel letter.",
    language: "lan-guage | LANG-gwij | /ˈlæŋ.ɡwɪdʒ/ | “gu” says /gw/ and “age” says /ij/.",
    surprise: "sur-prise | sur-PRYZ | /sɚˈpraɪz/ | Two r's: sur-prise. The first r is easy to drop.",
    immediately: "im-me-di-ate-ly | ih-MEE-dee-it-lee | /ɪˈmi.di.ɪt.li/ | Double m; “ate” sounds like “it”.",
    occasion: "oc-ca-sion | uh-KAY-zhun | /əˈkeɪ.ʒən/ | “sion” says /zhun/. Double c, single s.",
    embarrass: "em-bar-rass | im-BAIR-us | /ɪmˈbɛr.əs/ | Two r's and two s's.",
    knowledge: "knowl-edge | NOL-ij | /ˈnɑl.ɪdʒ/ | The k is silent; “dge” says /j/.",
    guarantee: "guar-an-tee | gair-un-TEE | /ˌɡɛr.ənˈti/ | “gu” says /g/: the u is silent.",
    mischievous: "mis-chie-vous | MIS-chuh-vus | /ˈmɪs.tʃə.vəs/ | Three syllables, not four: there is no “i” sound before -ous.",
    neighbor: "neigh-bor | NAY-bur | /ˈneɪ.bɚ/ | “eigh” says /ay/; the gh is silent.",
    achieve: "a-chieve | uh-CHEEV | /əˈtʃiv/ | “ie” says /ee/.",
    although: "al-though | awl-THOH | /ɔlˈðoʊ/ | “ough” says /oh/.",
    business: "busi-ness | BIZ-nis | /ˈbɪz.nɪs/ | The u and the i are not both heard: it sounds like “biz-nis”.",
    column: "col-umn | KOL-um | /ˈkɑl.əm/ | The n at the end is silent.",
    foreign: "for-eign | FOR-in | /ˈfɔr.ɪn/ | “eign” says /in/; the g is silent.",
    grateful: "grate-ful | GRAYT-ful | /ˈɡreɪt.fəl/ | The ending is -ful with one l.",
    height: "height | HYTE | /haɪt/ | “eigh” says /eye/ and the word ends in t, not th.",
    island: "is-land | EYE-lund | /ˈaɪ.lənd/ | The s is silent.",
    jewelry: "jew-el-ry | JOO-ul-ree | /ˈdʒu.əl.ri/ | Three syllables: jew-el-ry.",
    library: "li-brar-y | LY-brair-ee | /ˈlaɪ.brɛr.i/ | Say the first r: li-BRAR-y, not “lie-berry”.",
    medicine: "med-i-cine | MED-uh-sin | /ˈmɛd.ə.sɪn/ | “c” says /s/.",
    opposite: "op-po-site | OP-uh-zit | /ˈɑp.ə.zɪt/ | “site” says /zit/. Double p.",
    possible: "pos-si-ble | POS-uh-bul | /ˈpɑs.ə.bəl/ | Double s; the ending -ble sounds like “bul”.",
    question: "ques-tion | KWES-chun | /ˈkwɛs.tʃən/ | “qu” says /kw/; “tion” says /chun/ after s.",
    rhyme: "rhyme | RYME | /raɪm/ | “rh” is just /r/.",
    schedule: "sched-ule | SKEJ-ool | /ˈskɛdʒ.ul/ | “sch” says /sk/ in American English and the d sounds like /j/.",
    tomorrow: "to-mor-row | tuh-MOR-oh | /təˈmɔr.oʊ/ | One m, two r's.",
    umbrella: "um-brel-la | um-BREL-uh | /ʌmˈbrɛl.ə/ | Two l's at the end; the last syllable is a weak “uh”.",
    vegetable: "veg-e-ta-ble | VEJ-uh-tuh-bul | /ˈvɛdʒ.ə.tə.bəl/ | Often said in three syllables: VEJ-tuh-bul.",
    weather: "weath-er | WETH-ur | /ˈwɛð.ɚ/ | “ea” says a short /e/.",

    // ---------- expert ----------
    conscientious: "con-sci-en-tious | kon-shee-EN-shus | /ˌkɑn.ʃiˈɛn.ʃəs/ | “sc” says /sh/ and “tious” says /shus/.",
    onomatopoeia: "on-o-mat-o-poe-ia | on-uh-mat-uh-PEE-uh | /ˌɑn.əˌmæt.əˈpi.ə/ | “oeia” says /ee-uh/, and that is where the stress falls.",
    bureaucracy: "bu-reau-cra-cy | byoo-ROK-ruh-see | /bjʊˈrɑk.rə.si/ | “eau” says /o/ here.",
    questionnaire: "ques-tion-naire | kwes-chuh-NAIR | /ˌkwɛs.tʃəˈnɛr/ | Two n's: question + naire.",
    entrepreneur: "en-tre-pre-neur | on-truh-pruh-NUR | /ˌɑn.trə.prəˈnɝ/ | It starts with “on”, not “en”; “eur” says /ur/.",
    chrysanthemum: "chry-san-the-mum | krih-SAN-thuh-mum | /krɪˈsæn.θə.məm/ | “ch” says /k/ and the “th” is a real /th/.",
    idiosyncrasy: "id-i-o-syn-cra-sy | id-ee-oh-SING-kruh-see | /ˌɪd.i.oʊˈsɪŋ.krə.si/ | “syn” sounds like “sing”.",
    connoisseur: "con-nois-seur | kon-uh-SUR | /ˌkɑn.əˈsɝ/ | “oi” is weak and “eur” says /ur/.",
    camouflage: "cam-ou-flage | KAM-uh-flahzh | /ˈkæm.ə.flɑʒ/ | “age” says /ahzh/: it is a French word.",
    silhouette: "sil-hou-ette | sil-oo-ET | /ˌsɪl.uˈɛt/ | The h is silent.",
    rhinoceros: "rhi-noc-er-os | ry-NOS-ur-us | /raɪˈnɑs.ɚ.əs/ | “rh” is just /r/.",
    acquaintance: "ac-quaint-ance | uh-KWAYN-tuns | /əˈkweɪn.təns/ | “cq” sounds like /kw/.",
    millennium: "mil-len-ni-um | mih-LEN-ee-um | /mɪˈlɛn.i.əm/ | Two l's and two n's.",
    hierarchy: "hi-er-ar-chy | HY-uh-rar-kee | /ˈhaɪ.ɚˌɑr.ki/ | “ch” says /k/.",
    phenomenon: "phe-nom-e-non | fuh-NOM-uh-non | /fəˈnɑm.ə.nɑn/ | “ph” says /f/.",
    pneumonia: "pneu-mo-nia | noo-MOH-nyuh | /nuˈmoʊ.njə/ | The p is silent.",
    cappuccino: "cap-puc-ci-no | kap-uh-CHEE-noh | /ˌkæp.əˈtʃi.noʊ/ | “cc” before i says /ch/. Two p's, two c's.",
    kaleidoscope: "ka-lei-do-scope | kuh-LY-duh-skohp | /kəˈlaɪ.də.skoʊp/ | “ei” says /eye/ here.",

    // ---------- more beginner ----------
    bird: "bird | BURD | /bɝd/ | “ir” says /ur/.",
    fish: "fish | FISH | /fɪʃ/",
    tree: "tree | TREE | /tri/",
    star: "star | STAR | /stɑr/",
    moon: "moon | MOON | /mun/",
    ball: "ball | BAWL | /bɔl/ | “a” says /aw/ before ll.",
    cake: "cake | KAYK | /keɪk/ | The final e is silent and makes the a say its name.",
    bike: "bike | BYKE | /baɪk/ | The final e is silent and makes the i say its name.",
    rain: "rain | RAYN | /reɪn/ | “ai” says /ay/.",
    snow: "snow | SNOH | /snoʊ/ | “ow” says /oh/ here.",
    shoe: "shoe | SHOO | /ʃu/ | “oe” says /oo/ here.",
    hand: "hand | HAND | /hænd/",
    door: "door | DOR | /dɔr/ | “oo” says /o/ here.",
    desk: "desk | DESK | /dɛsk/",
    lamp: "lamp | LAMP | /læmp/",
    picture: "pic-ture | PIK-chur | /ˈpɪk.tʃɚ/ | “ture” says /chur/.",
    another: "an-oth-er | uh-NUTH-ur | /əˈnʌð.ɚ/ | The “o” says /u/.",
    thought: "thought | THAWT | /θɔt/ | “ough” says /aw/; the gh is silent.",
    through: "through | THROO | /θru/ | “ough” says /oo/; the gh is silent.",
    careful: "care-ful | KAIR-ful | /ˈkɛr.fəl/ | The ending is -ful with one l.",
    kitchen: "kitch-en | KICH-un | /ˈkɪtʃ.ən/ | “tch” says /ch/.",
    morning: "morn-ing | MOR-ning | /ˈmɔr.nɪŋ/",
    evening: "eve-ning | EEV-ning | /ˈiv.nɪŋ/",
    holiday: "hol-i-day | HOL-uh-day | /ˈhɑl.ə.deɪ/",
    cousin: "cous-in | KUZ-in | /ˈkʌz.ɪn/ | “ou” says /u/, like in “cut”.",
    sister: "sis-ter | SIS-tur | /ˈsɪs.tɚ/",
    brother: "broth-er | BRUTH-ur | /ˈbrʌð.ɚ/ | “o” says /u/.",
    teacher: "teach-er | TEE-chur | /ˈti.tʃɚ/",
    student: "stu-dent | STOO-dunt | /ˈstu.dənt/",
    journey: "jour-ney | JUR-nee | /ˈdʒɝ.ni/ | “ou” says /ur/.",
    hungry: "hun-gry | HUNG-gree | /ˈhʌŋ.ɡri/",
    thirsty: "thirst-y | THUR-stee | /ˈθɝ.sti/ | “ir” says /ur/.",
    thankful: "thank-ful | THANGK-ful | /ˈθæŋk.fəl/ | The ending is -ful with one l.",
    birthday: "birth-day | BURTH-day | /ˈbɝθ.deɪ/",
    remember: "re-mem-ber | rih-MEM-bur | /rɪˈmɛm.bɚ/",
    alphabet: "al-pha-bet | AL-fuh-bet | /ˈæl.fə.bɛt/ | “ph” says /f/.",
    computer: "com-put-er | kum-PYOO-tur | /kəmˈpju.tɚ/ | “u” says /yoo/.",
    continue: "con-tin-ue | kun-TIN-yoo | /kənˈtɪn.ju/ | The ending -ue says /yoo/.",
    decision: "de-ci-sion | dih-SIZH-un | /dɪˈsɪʒ.ən/ | “sion” says /zhun/.",
    exercise: "ex-er-cise | EK-sur-syze | /ˈɛk.sɚ.saɪz/ | “cise” says /syze/.",
    furniture: "fur-ni-ture | FUR-nuh-chur | /ˈfɝ.nɪ.tʃɚ/ | “ture” says /chur/.",
    direction: "di-rec-tion | duh-REK-shun | /dəˈrɛk.ʃən/ | “tion” says /shun/.",
    character: "char-ac-ter | KAIR-ik-tur | /ˈkɛr.ɪk.tɚ/ | “ch” says /k/.",
    adventure: "ad-ven-ture | ud-VEN-chur | /ədˈvɛn.tʃɚ/ | “ture” says /chur/.",
    chocolate: "choc-o-late | CHOK-uh-lit | /ˈtʃɑk.ə.lɪt/ | Often said in two syllables: CHOK-lit.",
    dangerous: "dan-ger-ous | DAYN-jur-us | /ˈdeɪn.dʒɚ.əs/ | “a” says its name and “ge” says /j/.",
    difficult: "dif-fi-cult | DIF-ih-kult | /ˈdɪf.ɪ.kəlt/ | Double f.",
    vacation: "va-ca-tion | vay-KAY-shun | /veɪˈkeɪ.ʃən/ | “tion” says /shun/.",
    mountain: "moun-tain | MOWN-tun | /ˈmaʊn.tən/ | “ain” sounds like “un”.",
    thousand: "thou-sand | THOW-zund | /ˈθaʊ.zənd/ | “s” says /z/ here.",
    hospital: "hos-pi-tal | HOS-pih-tul | /ˈhɑs.pɪ.təl/",
    dictionary: "dic-tion-ar-y | DIK-shuh-ner-ee | /ˈdɪk.ʃə.nɛr.i/ | “tion” says /shun/.",
    temperature: "tem-per-a-ture | TEM-pur-uh-chur | /ˈtɛm.pɚ.ə.tʃɚ/ | Four syllables, and “ture” says /chur/.",
    disappear: "dis-ap-pear | dis-uh-PEER | /ˌdɪs.əˈpɪr/ | One s, then two p's.",
    disappoint: "dis-ap-point | dis-uh-POINT | /ˌdɪs.əˈpɔɪnt/ | One s, then two p's.",
    appreciate: "ap-pre-ci-ate | uh-PREE-shee-ayt | /əˈpri.ʃi.eɪt/ | “ci” says /sh/.",
    communicate: "com-mu-ni-cate | kuh-MYOO-nuh-kayt | /kəˈmju.nə.keɪt/ | Double m.",
    experience: "ex-pe-ri-ence | ik-SPEER-ee-uns | /ɪkˈspɪr.i.əns/ | Ends in -ence.",
    imagination: "i-mag-i-na-tion | ih-maj-uh-NAY-shun | /ɪˌmædʒ.əˈneɪ.ʃən/ | “g” says /j/ and “tion” says /shun/.",
    information: "in-for-ma-tion | in-fur-MAY-shun | /ˌɪn.fɚˈmeɪ.ʃən/ | “tion” says /shun/.",
    personality: "per-son-al-i-ty | pur-suh-NAL-ih-tee | /ˌpɝ.səˈnæl.ɪ.ti/ | The stress moves to “nal”.",
    professional: "pro-fes-sion-al | pruh-FESH-uh-nul | /prəˈfɛʃ.ə.nəl/ | Double s; “ssion” says /shun/.",
    unfortunately: "un-for-tu-nate-ly | un-FOR-chuh-nit-lee | /ʌnˈfɔr.tʃə.nɪt.li/ | “tu” says /chuh/.",
    responsibility: "re-spon-si-bil-i-ty | rih-spon-suh-BIL-ih-tee | /rɪˌspɑn.sə.ˈbɪl.ɪ.ti/ | Six syllables; the stress is on “bil”.",
    extraordinary: "ex-traor-di-nar-y | ik-STROR-duh-ner-ee | /ɪkˈstrɔr.də.nɛr.i/ | Not “extra-ordinary”: say ik-STROR-duh-ner-ee.",
    conscience: "con-science | KON-shuns | /ˈkɑn.ʃəns/ | “sc” says /sh/.",
    pronunciation: "pro-nun-ci-a-tion | pruh-nun-see-AY-shun | /prəˌnʌn.siˈeɪ.ʃən/ | Say “nun”, not “noun”: there is no “ou”.",
    miscellaneous: "mis-cel-la-ne-ous | mis-uh-LAY-nee-us | /ˌmɪs.əˈleɪ.ni.əs/ | “sc” says /s/; ends in -eous.",
    unprecedented: "un-prec-e-dent-ed | un-PRES-uh-den-tid | /ʌnˈprɛs.ɪˌdɛn.tɪd/ | Starts with un-; the stress is on “pres”.",
    indispensable: "in-dis-pens-a-ble | in-dis-PEN-suh-bul | /ˌɪn.dɪˈspɛn.sə.bəl/ | Ends in -able, not -ible.",
    subconscious: "sub-con-scious | sub-KON-shus | /ˌsʌbˈkɑn.ʃəs/ | “sc” says /sh/.",
    exaggerate: "ex-ag-ger-ate | ig-ZAJ-uh-rayt | /ɪɡˈzædʒ.ə.reɪt/ | “x” says /gz/ and “gg” says /j/ here.",
    maintenance: "main-te-nance | MAYN-tuh-nuns | /ˈmeɪn.tə.nəns/ | Not “maintain” + ance: the middle is “te”.",
    questionable: "ques-tion-a-ble | KWES-chun-uh-bul | /ˈkwɛs.tʃə.nə.bəl/ | Ends in -able.",
    perseverance: "per-se-ver-ance | pur-suh-VEER-uns | /ˌpɝ.səˈvɪr.əns/ | Ends in -ance.",
    vulnerable: "vul-ner-a-ble | VUL-nur-uh-bul | /ˈvʌl.nɚ.ə.bəl/ | Say the first l: it is “vul”, not “vun”.",

    // ---------- US / UK spelling pairs (same sound in both spellings) ----------
    color: "col-or | KUL-ur | /ˈkʌl.ɚ/ | “o” says /u/.",
    honor: "hon-or | ON-ur | /ˈɑn.ɚ/ | The h is silent.",
    flavor: "fla-vor | FLAY-vur | /ˈfleɪ.vɚ/",
    humor: "hu-mor | HYOO-mur | /ˈhju.mɚ/ | Say the h, then /yoo/.",
    labor: "la-bor | LAY-bur | /ˈleɪ.bɚ/",
    rumor: "ru-mor | ROO-mur | /ˈru.mɚ/",
    harbor: "har-bor | HAR-bur | /ˈhɑr.bɚ/",
    vapor: "va-por | VAY-pur | /ˈveɪ.pɚ/",
    center: "cen-ter | SEN-tur | /ˈsɛn.tɚ/ | The first c says /s/.",
    theater: "the-a-ter | THEE-uh-tur | /ˈθi.ə.tɚ/ | Three syllables.",
    meter: "me-ter | MEE-tur | /ˈmi.tɚ/",
    liter: "li-ter | LEE-tur | /ˈli.tɚ/ | “i” says /ee/ here.",
    fiber: "fi-ber | FY-bur | /ˈfaɪ.bɚ/",
    organize: "or-gan-ize | OR-guh-nyze | /ˈɔr.ɡə.naɪz/ | “ize” says /eyez/.",
    realize: "re-al-ize | REE-uh-lyze | /ˈri.ə.laɪz/ | “ize” says /eyez/.",
    recognize: "rec-og-nize | REK-ug-nyze | /ˈrɛk.əɡ.naɪz/ | The g is pronounced: rec-og-nize.",
    apologize: "a-pol-o-gize | uh-POL-uh-jyze | /əˈpɑl.ə.dʒaɪz/ | “g” says /j/.",
    memorize: "mem-o-rize | MEM-uh-ryze | /ˈmɛm.ə.raɪz/ | “ize” says /eyez/.",
    catalog: "cat-a-log | KAT-uh-lawg | /ˈkæt.ə.lɔɡ/",
    dialog: "di-a-log | DY-uh-lawg | /ˈdaɪ.ə.lɔɡ/",
    defense: "de-fense | dih-FENS | /dɪˈfɛns/ | In sports, the noun is often said DEE-fens.",
    license: "li-cense | LY-suns | /ˈlaɪ.səns/ | “c” says /s/.",
    traveling: "trav-el-ing | TRAV-uh-ling | /ˈtræv.ə.lɪŋ/",
    canceled: "can-celed | KAN-suld | /ˈkæn.səld/ | “c” says /s/ and “ed” sounds like “d”.",
    gray: "gray | GRAY | /ɡreɪ/",
    pajamas: "pa-ja-mas | puh-JAH-muz | /pəˈdʒɑ.məz/ | “j” says /j/ and “a” says /ah/.",
    mustache: "mus-tache | MUS-tash | /ˈmʌs.tæʃ/ | “ache” says /ash/.",
    fulfill: "ful-fill | ful-FIL | /fʊlˈfɪl/ | Double l in “fill”, but a single l in “ful”.",

    // ---------- hard ----------
    achievement: "a-chieve-ment | uh-CHEEV-munt | /əˈtʃiv.mənt/ | “ie” says /ee/.",
    committee: "com-mit-tee | kuh-MIT-ee | /kəˈmɪt.i/ | Double m, double t, double e.",
    conscious: "con-scious | KON-shus | /ˈkɑn.ʃəs/ | “sc” says /sh/.",
    existence: "ex-is-tence | ig-ZIS-tuns | /ɪɡˈzɪs.təns/ | Ends in -ence.",
    independent: "in-de-pen-dent | in-dih-PEN-dunt | /ˌɪn.dɪˈpɛn.dənt/ | Ends in -ent.",
    occurrence: "oc-cur-rence | uh-KUR-uns | /əˈkɝ.əns/ | Double c, double r.",
    parallel: "par-al-lel | PAIR-uh-lel | /ˈpɛr.ə.lɛl/ | A double l in the middle, then a single l at the end.",
    possession: "pos-ses-sion | puh-ZESH-un | /pəˈzɛʃ.ən/ | Two double s's; the first “ss” sounds like /z/.",
    privilege: "priv-i-lege | PRIV-uh-lij | /ˈprɪv.ə.lɪdʒ/ | “ege” says /ij/.",
    recommend: "rec-om-mend | rek-uh-MEND | /ˌrɛk.əˈmɛnd/ | One c, two m's.",
    sincerely: "sin-cere-ly | sin-SEER-lee | /sɪnˈsɪr.li/ | “c” says /s/.",
    cemetery: "cem-e-ter-y | SEM-uh-ter-ee | /ˈsɛm.ə.tɛr.i/ | Ends in -ery, not -ary.",
    handkerchief: "hand-ker-chief | HANG-kur-chif | /ˈhæŋ.kɚ.tʃɪf/ | The d is silent; “chief” says /chif/.",
    sacrilege: "sac-ri-lege | SAK-ruh-lij | /ˈsæk.rə.lɪdʒ/ | “ege” says /ij/.",
    yacht: "yacht | YAHT | /jɑt/ | “acht” says /ot/; the ch is silent.",
    colonel: "colo-nel | KUR-nul | /ˈkɝ.nəl/ | Said like “kernel”: the first l sounds like r.",
    accommodate: "ac-com-mo-date | uh-KOM-uh-dayt | /əˈkɑm.ə.deɪt/ | Double c, double m.",
    acquiesce: "ac-qui-esce | ak-wee-ES | /ˌæk.wiˈɛs/ | “qu” says /kw/ and “sce” says /s/.",
    liaison: "li-ai-son | lee-AY-zon | /liˈeɪ.zɑn/ | “s” says /z/.",
    reminiscence: "rem-i-nis-cence | rem-uh-NIS-uns | /ˌrɛm.ɪˈnɪs.əns/ | “sc” says /s/.",
    renaissance: "ren-ais-sance | REN-uh-sahns | /ˈrɛn.ə.sɑns/ | “ai” is weak: it sounds like “uh”.",
    sovereignty: "sov-er-eign-ty | SOV-ur-in-tee | /ˈsɑv.ɚ.ɪn.ti/ | “eign” says /in/.",
    surreptitious: "sur-rep-ti-tious | sur-up-TISH-us | /ˌsɝ.əpˈtɪʃ.əs/ | “tious” says /shus/.",
    unanimous: "u-nan-i-mous | yoo-NAN-uh-mus | /juˈnæn.ə.məs/ | The first u says /yoo/.",
    vengeance: "ven-geance | VEN-juns | /ˈvɛn.dʒəns/ | “ge” says /j/.",
    whimsical: "whim-si-cal | WIM-zih-kul | /ˈwɪm.zɪ.kəl/ | “s” says /z/.",

    // ---------- more expert ----------
    camaraderie: "ca-ma-ra-de-rie | kah-muh-RAH-duh-ree | /ˌkɑ.məˈrɑ.də.ri/ | A French word: “ie” says /ee/.",
    gauge: "gauge | GAYJ | /ɡeɪdʒ/ | “au” says /ay/ and “ge” says /j/.",
    inoculate: "in-oc-u-late | ih-NOK-yuh-layt | /ɪˈnɑk.jə.leɪt/ | One n, one c.",
    juxtapose: "jux-ta-pose | JUK-stuh-pohz | /ˈdʒʌk.stə.poʊz/ | “x” says /ks/.",
    labyrinth: "lab-y-rinth | LAB-uh-rinth | /ˈlæb.ə.rɪnθ/ | “y” says /uh/ in the middle.",
    mnemonic: "mne-mon-ic | nih-MON-ik | /nɪˈmɑn.ɪk/ | “mn” says /n/: the m is silent.",
    paraphernalia: "par-a-pher-na-lia | pair-uh-fur-NAYL-yuh | /ˌpɛr.ə.fɚˈneɪl.jə/ | “ph” says /f/.",
    pharaoh: "pha-raoh | FAIR-oh | /ˈfɛr.oʊ/ | “ph” says /f/ and “aoh” says /oh/.",
    supersede: "su-per-sede | soo-pur-SEED | /ˌsu.pɚˈsid/ | One of the only words ending in -sede.",
    cinnamon: "cin-na-mon | SIN-uh-mun | /ˈsɪn.ə.mən/ | “c” says /s/; double n.",
    physician: "phy-si-cian | fih-ZISH-un | /fɪˈzɪʃ.ən/ | “ph” says /f/ and “cian” says /shun/.",
    resemblance: "re-sem-blance | rih-ZEM-bluns | /rɪˈzɛm.bləns/ | “s” says /z/.",
    trustworthy: "trust-wor-thy | TRUST-wur-thee | /ˈtrʌst.wɝ.ði/ | “wor” says /wur/.",
    prestigious: "pres-ti-gious | pres-TEE-jus | /prɛˈsti.dʒəs/ | “gious” says /jus/.",
  };

  function parse(word, row) {
    const [syl, say, ipa, note] = row.split("|").map((p) => p.trim());
    const syllables = syl.split("-");
    const parts = say.split("-");
    // The stressed part is the uppercase one; single-syllable words have no stress to show.
    const stress = parts.length > 1 ? parts.findIndex((p) => p === p.toUpperCase()) : -1;
    return { word, syllables, say: parts, stress, ipa, note: note || "" };
  }

  // Rows that did not come from this file (AI-generated words) are untrusted, so every property the
  // guide relies on is checked, and a row that fails any check is rejected whole.
  function fromRow(word, row) {
    if (typeof row !== "string" || row.length > 500) return null;
    const parts = row.split("|").map((p) => p.trim());
    if (parts.length < 3 || parts.length > 4) return null;
    const [syl, say, ipaRaw, note = ""] = parts;
    const syllables = syl.toLowerCase().split("-");
    if (syllables.join("") !== String(word).toLowerCase() || syllables.some((s) => !/^[a-z]+$/.test(s))) return null;
    let spoken = say.split("-");
    if (spoken.length !== syllables.length || spoken.some((p) => !/^[A-Za-z]+$/.test(p))) return null;
    if (spoken.length === 1) spoken = [spoken[0].toUpperCase()];
    else if (spoken.filter((p) => p === p.toUpperCase()).length !== 1) return null; // exactly one stressed part
    const ipa = /^\/[^/]{1,60}\/$/.test(ipaRaw) ? ipaRaw : /^[^/]{1,60}$/.test(ipaRaw) ? `/${ipaRaw}/` : "";
    if (!ipa || note.length > 160) return null;
    return {
      word: String(word).toLowerCase(), syllables, say: spoken,
      stress: spoken.length > 1 ? spoken.findIndex((p) => p === p.toUpperCase()) : -1,
      ipa, note, source: "ai",
    };
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
    const guide = row ? parse(key, row) : null;
    cache.set(key, guide);
    return guide;
  }

  // The built-in, hand-checked guide wins; a word's own AI-written row is the fallback.
  function forEntry(entry) {
    if (!entry) return null;
    return get(entry.word) || fromRow(entry.word, entry.sounds);
  }

  window.SpellSounds = { get, fromRow, forEntry, rows: ROWS };
})();
