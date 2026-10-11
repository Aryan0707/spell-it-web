// Passages for the reading trainer (reading.js). All are general-interest non-fiction of about the
// same length and difficulty, so speeds measured on different passages can be compared fairly.
// Each has three questions: the main idea (gist), a stated fact, and something to work out (inference).
// `answer` is the index of the right option.
(() => {
  "use strict";

  const PASSAGES = [
    {
      id: "octopus",
      title: "The clever octopus",
      paragraphs: [
        "An octopus has no bones, which lets it squeeze through any gap larger than its beak, the only hard part of its body. Aquarium keepers have learned this the hard way. Octopuses have slipped out of tanks at night, crossed the floor to a neighbouring tank, eaten a fish or two, and returned home before morning.",
        "Its brain is unusual too. Most of an octopus's nerve cells are not in its head but spread through its eight arms. Each arm can taste what it touches and react without waiting for instructions, so an arm can keep searching a crack in a rock while the animal looks somewhere else.",
        "Scientists have watched octopuses open screw-top jars, carry coconut shells to use as shelters, and squirt water at lights they seem to dislike. For an animal that usually lives only a year or two and never meets its parents, that is a remarkable amount of problem solving. Everything it knows, it must work out alone.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How octopuses hunt fish", "How an octopus's body and brain make it a capable problem solver", "Why octopuses live in aquariums", "How octopuses raise their young"], answer: 1 },
        { kind: "fact", q: "Where are most of an octopus's nerve cells?", options: ["In its head", "In its beak", "In its arms", "In its skin"], answer: 2 },
        { kind: "inference", q: "Why is it surprising that octopuses solve problems so well?", options: ["They have no brain at all", "They live short lives and learn without parents", "They cannot see", "They only live in tanks"], answer: 1 },
      ],
    },
    {
      id: "bees",
      title: "How bees share directions",
      paragraphs: [
        "When a honeybee finds a good patch of flowers, she flies back to the hive and tells her sisters where it is. She does this with a dance. On the vertical honeycomb, she runs a short straight line while waggling her body, loops back round, and repeats the run again and again.",
        "The direction of the straight run shows the direction of the food. Running straight up the comb means \"fly towards the sun\". Running at an angle to the left of straight up means \"fly at that same angle to the left of the sun\". The length of the waggle tells the distance: the longer she waggles, the farther away the flowers are.",
        "Other bees crowd around the dancer, feel her movements in the dark hive, and smell the flowers on her body. Then they fly straight to a spot they have never visited. The Austrian scientist Karl von Frisch worked out this code in the 1940s, and in 1973 he shared a Nobel Prize for the discovery.",
      ],
      questions: [
        { kind: "gist", q: "What does the passage explain?", options: ["How bees make honey", "How a bee's dance tells others where food is", "Why bees sting", "How the hive is built"], answer: 1 },
        { kind: "fact", q: "What does the length of the waggle tell the other bees?", options: ["The type of flower", "The direction of the sun", "How far away the food is", "How much food there is"], answer: 2 },
        { kind: "inference", q: "Why do bees need to feel the dance rather than watch it?", options: ["The hive is dark inside", "Bees cannot see colours", "The dance is too fast", "They are asleep"], answer: 0 },
      ],
    },
    {
      id: "lighthouse",
      title: "Why lighthouses flash",
      paragraphs: [
        "A ship's captain sailing at night needs to know not just that land is near, but exactly which piece of land it is. A steady light on the shore says little. It could be a house, a harbour or a different lighthouse twenty miles away. So each lighthouse is given its own pattern, called its characteristic.",
        "One lighthouse might give a single flash every five seconds. Another might give two quick flashes and then darkness for ten seconds. Some show a colour, such as red, over dangerous waters. Sailors carry a printed list of these patterns, so by timing the flashes with a watch they can find their position on the chart.",
        "Today most ships use satellite navigation, and many lighthouses run automatically with no keeper living inside. Yet they are still kept working. Electronics can fail, batteries can die, and a light that can be seen with the naked eye remains the simplest backup there is.",
      ],
      questions: [
        { kind: "gist", q: "What is the main point of the passage?", options: ["Lighthouses are no longer needed", "Each lighthouse's flash pattern lets sailors tell exactly where they are", "Lighthouse keepers live alone", "Red lights mean a harbour"], answer: 1 },
        { kind: "fact", q: "What is a lighthouse's flash pattern called?", options: ["Its signal", "Its beacon", "Its characteristic", "Its code"], answer: 2 },
        { kind: "inference", q: "Why are lighthouses still kept working today?", options: ["Satellite navigation is illegal at sea", "They are a reliable backup if electronics fail", "Ships have no lights", "Keepers need jobs"], answer: 1 },
      ],
    },
    {
      id: "sleep",
      title: "Sleep and memory",
      paragraphs: [
        "It is tempting to treat sleep as wasted time, especially before an exam. But while you sleep, your brain is busy with work it cannot do as well while you are awake. One of its main jobs is sorting through the day's experiences and deciding what to keep.",
        "During deep sleep, the brain replays patterns of activity from earlier in the day. This replay seems to move new memories from short-term storage into longer-lasting networks. In many studies, people who learned a task and then slept remembered it better than people who learned it and stayed awake for the same number of hours.",
        "Sleep also seems to help the brain spot connections. People given a puzzle with a hidden shortcut were more likely to discover the shortcut after a night's sleep than after the same time awake. So staying up all night to study can backfire. The hours you gain for reading may cost you the memories you were trying to build.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly arguing?", options: ["Sleep helps the brain store and connect memories", "Exams should be held in the morning", "Deep sleep is the same as dreaming", "Most people sleep too much"], answer: 0 },
        { kind: "fact", q: "In the studies, who remembered a task better?", options: ["People who stayed awake", "People who slept after learning", "People who learned it twice", "There was no difference"], answer: 1 },
        { kind: "inference", q: "What would the writer most likely advise a student the night before a test?", options: ["Study all night", "Get a proper night's sleep", "Skip revision entirely", "Sleep during the test"], answer: 1 },
      ],
    },
    {
      id: "printing",
      title: "The printing press",
      paragraphs: [
        "Before the middle of the 1400s, most books in Europe were copied by hand. A single Bible could take a skilled scribe more than a year to finish, so books were rare and expensive, and most people never owned one.",
        "Around 1450, Johannes Gutenberg, a goldsmith in the German city of Mainz, built a printing press with movable metal type. Each letter was cast as a separate small block. The blocks could be arranged into a page, inked, pressed onto paper, and then taken apart and reused for the next page. Printing had existed before, but Gutenberg's metal type, oil-based ink and adapted wine press made it fast and dependable.",
        "Within fifty years, printers were working in more than two hundred European towns, and millions of books had been produced. Ideas could now travel faster than any one person could carry them. Scientists could check each other's results, and arguments about religion and government spread across borders in weeks rather than years.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage about?", options: ["The life of a scribe", "How Gutenberg's press made books common and spread ideas", "The history of the Bible", "Why goldsmiths were rich"], answer: 1 },
        { kind: "fact", q: "Where was Gutenberg working?", options: ["Paris", "Venice", "Mainz", "London"], answer: 2 },
        { kind: "inference", q: "Why did movable type save so much time?", options: ["Letters could be reused for page after page", "It needed no ink", "It printed in colour", "It used no paper"], answer: 0 },
      ],
    },
    {
      id: "tides",
      title: "What causes the tides",
      paragraphs: [
        "Twice a day, almost everywhere along the world's coasts, the sea creeps up the beach and then slides away again. The main cause is the Moon. Its gravity pulls on the whole Earth, but it pulls a little harder on the side nearest to it and a little more weakly on the far side.",
        "That difference stretches the oceans into two bulges: one facing the Moon and one on the opposite side of the planet. As the Earth turns, a coastline passes through both bulges each day, which is why most places get two high tides roughly every twenty-five hours.",
        "The Sun has a smaller tidal pull of its own. When the Sun and Moon line up, at new moon and full moon, their pulls add together and the tides are higher than usual. These are called spring tides, although they have nothing to do with the season. When the Sun and Moon pull at right angles, the tides are weaker, and these are called neap tides.",
      ],
      questions: [
        { kind: "gist", q: "What does the passage explain?", options: ["How the Moon and Sun cause rising and falling tides", "Why beaches erode", "How the Moon formed", "Why spring is warmer"], answer: 0 },
        { kind: "fact", q: "When do spring tides happen?", options: ["Only in spring", "At new moon and full moon", "When the Moon is at right angles to the Sun", "Once a year"], answer: 1 },
        { kind: "inference", q: "Why are there two bulges instead of one?", options: ["There are two moons", "The Moon pulls unevenly on the near and far sides of Earth", "The Sun creates the second one", "Wind pushes water to the far side"], answer: 1 },
      ],
    },
    {
      id: "pencil",
      title: "The \"lead\" in a pencil",
      paragraphs: [
        "There is no lead in a pencil, and there never has been. The grey core is graphite, a soft form of carbon. When a large deposit of pure graphite was found in Cumbria, England, in the 1500s, people thought it was a type of lead, and the name stuck.",
        "That deposit was so pure that it could be sawn into sticks and used straight from the ground. Elsewhere, graphite was crumbly and mixed with other material. In the 1790s, the French engineer Nicolas-Jacques Conté found a solution: grind the graphite into powder, mix it with clay, shape it, and bake it in a kiln.",
        "Conté's method is still used today, and it brought a useful bonus. By changing the amount of clay, makers could control the hardness. More clay gives a harder pencil with a lighter line, marked H. More graphite gives a softer, darker line, marked B. An everyday HB pencil sits in the middle.",
      ],
      questions: [
        { kind: "gist", q: "What is the main topic?", options: ["Why lead is poisonous", "What a pencil core really is and how it is made", "The history of Cumbria", "How to sharpen a pencil"], answer: 1 },
        { kind: "fact", q: "What did Conté mix with graphite powder?", options: ["Wax", "Lead", "Clay", "Charcoal"], answer: 2 },
        { kind: "inference", q: "A pencil marked 4B would draw a line that is…", options: ["Harder and lighter than HB", "Softer and darker than HB", "Exactly like HB", "Coloured"], answer: 1 },
      ],
    },
    {
      id: "heat-island",
      title: "Why cities run hot",
      paragraphs: [
        "On a summer evening, the middle of a large city can be several degrees warmer than the countryside around it. Scientists call this the urban heat island effect, and it has a few simple causes.",
        "Dark roads and roofs absorb sunlight during the day and slowly release that heat after sunset. Tall buildings trap warm air and block the breeze. Cars, air conditioners and factories add heat of their own. Meanwhile, a city has far fewer trees and fields, which cool the air by giving off water vapour from their leaves.",
        "The extra heat is more than uncomfortable. During heatwaves it can be dangerous, especially for older people. Cities are fighting back in several ways: painting roofs white or pale grey to reflect sunlight, planting trees along streets, and covering some rooftops with plants. Each step on its own makes a small difference, but together they can lower street temperatures noticeably on the hottest days.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["Why cities are warmer than the countryside and what can help", "How air conditioners work", "Why people move to cities", "How to plant a tree"], answer: 0 },
        { kind: "fact", q: "How do trees help cool the air?", options: ["By blocking the wind", "By giving off water vapour from their leaves", "By absorbing car fumes", "By reflecting light like white roofs"], answer: 1 },
        { kind: "inference", q: "Why would a pale roof stay cooler than a dark one?", options: ["It reflects more sunlight", "It is made of plants", "It is taller", "It has no air conditioner"], answer: 0 },
      ],
    },
    {
      id: "vaccines",
      title: "How a vaccine trains the body",
      paragraphs: [
        "Your immune system learns from experience. The first time a new germ gets into your body, it takes several days to work out how to fight it, which is why you feel ill. But it also keeps a record. Special memory cells stay in your blood, sometimes for decades, ready to recognise that germ if it returns.",
        "A vaccine gives the immune system that experience without the dangerous illness. It might contain a weakened or killed germ, or just one harmless piece of it, or instructions that let your own cells make that piece for a short while. The immune system reacts, builds memory cells, and then the vaccine itself is cleared away.",
        "If the real germ arrives later, the memory cells recognise it at once and the body attacks within hours instead of days. Often the germ is destroyed before it can make you sick at all. When enough people in a community are protected this way, a germ struggles to spread, which also shields people who cannot be vaccinated.",
      ],
      questions: [
        { kind: "gist", q: "What does the passage explain?", options: ["How vaccines are invented", "How a vaccine teaches the immune system to recognise a germ", "Why germs exist", "How blood is made"], answer: 1 },
        { kind: "fact", q: "What stays in the blood, ready to recognise a germ again?", options: ["Memory cells", "The vaccine", "Weakened germs", "Fever"], answer: 0 },
        { kind: "inference", q: "Why do you usually feel ill the first time you meet a new germ?", options: ["The immune system takes days to learn how to fight it", "Memory cells attack too fast", "Vaccines cause it", "Germs are always deadly"], answer: 0 },
      ],
    },
    {
      id: "salt",
      title: "Salt, a valuable mineral",
      paragraphs: [
        "Salt is cheap and found in every kitchen today, but for most of history it was precious. Before refrigerators, salt was one of the few reliable ways to stop meat and fish from rotting. Packing food in salt draws water out of it, and the bacteria that cause decay cannot grow without water.",
        "Because people everywhere needed it, salt became a major trade good. Caravans of camels carried slabs of it across the Sahara, and in some places it was traded for gold. Governments noticed too. Many rulers taxed salt heavily, knowing that everyone had to buy it.",
        "Those taxes could cause serious anger. In 1930, Mahatma Gandhi led thousands of people on a walk of nearly 400 kilometres to the sea in protest against the British salt tax in India. At the end, he picked up a handful of natural salt from the shore, breaking the law in a simple act that drew attention around the world.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How to cook with salt", "Why salt was so valuable in history", "The geography of the Sahara", "The life of Gandhi"], answer: 1 },
        { kind: "fact", q: "Why does salt stop food from rotting?", options: ["It kills all germs instantly", "It draws water out, so decay bacteria cannot grow", "It makes food cold", "It seals the food in a crust"], answer: 1 },
        { kind: "inference", q: "Why did rulers find salt such a good thing to tax?", options: ["Only rich people bought it", "Everyone needed it, so everyone had to pay", "It was easy to make at home", "It was illegal"], answer: 1 },
      ],
    },
  ];

  const api = { PASSAGES };
  if (typeof window !== "undefined") window.SpellReadingPassages = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
