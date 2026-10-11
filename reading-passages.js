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

  // Advanced passages (levels 5–7): denser, more academic texts, about 250–300 words. Five questions each
  // (main idea, two facts, two inferences) so understanding is measured in 20% steps, plus three scanning
  // targets. Each `find` is a phrase that appears exactly once in the passage: the learner taps it.
  const ADVANCED_PASSAGES = [
    {
      id: "resistance",
      title: "Why antibiotics stop working",
      paragraphs: [
        "When Alexander Fleming accepted his share of the Nobel Prize in 1945, he used part of his lecture to issue a warning. Penicillin, the drug he had discovered in 1928, was already saving thousands of lives, yet he cautioned that bacteria exposed to too little of it could learn to survive it. Within a few decades his prediction had become one of the defining problems of modern medicine.",
        "The process Fleming feared is natural selection operating at extraordinary speed. A single infection may involve billions of bacteria, and in favourable conditions some species can divide roughly every twenty minutes. Among so many cells, random mutations occasionally produce one that tolerates a drug slightly better than its neighbours. When an antibiotic is applied, the susceptible majority dies while the tolerant minority survives and multiplies, so the next generation is dominated by resistant descendants.",
        "Bacteria have a further advantage that animals lack. They can pass small loops of DNA, called plasmids, directly to one another, even across species. A resistance gene that evolves in a harmless gut bacterium can therefore end up in a dangerous pathogen without either organism inheriting it from a parent.",
        "Consequently, every unnecessary prescription carries a hidden cost. Antibiotics have no effect on viruses, so taking them for a common cold provides no benefit while still applying selective pressure to the bacteria living in the body. Similarly, the routine use of antibiotics to make farm animals grow faster, banned in the European Union since 2006, exposed vast bacterial populations to low doses: precisely the conditions Fleming warned about.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How Fleming discovered penicillin", "How bacteria evolve and share resistance, and why misuse speeds it up", "Why viruses are harder to treat than bacteria", "How farm animals are raised in Europe"], answer: 1 },
        { kind: "fact", q: "What are plasmids?", options: ["Drugs that kill viruses", "Small loops of DNA that bacteria can pass to one another", "Bacteria that live in the gut", "A type of white blood cell"], answer: 1 },
        { kind: "fact", q: "Why does taking antibiotics for a cold not help?", options: ["Colds are caused by viruses, which antibiotics do not affect", "The dose is always too small", "Cold bacteria are already resistant", "Antibiotics only work in animals"], answer: 0 },
        { kind: "inference", q: "Why does the speed at which bacteria divide matter for resistance?", options: ["Many generations pass quickly, so a resistant variant can soon take over", "Fast-dividing bacteria cannot mutate", "It makes antibiotics stronger", "It stops plasmids from spreading"], answer: 0 },
        { kind: "inference", q: "What does the paragraph about plasmids suggest?", options: ["Resistance only matters in dangerous species", "Resistance that appears in harmless bacteria can still become a danger", "Harmless bacteria cannot carry resistance", "Plasmids make bacteria weaker"], answer: 1 },
      ],
      scans: [
        { q: "In what year did Fleming discover penicillin?", find: "1928" },
        { q: "How often can some bacteria divide in good conditions?", find: "every twenty minutes" },
        { q: "Where were antibiotics for faster growth in farm animals banned?", find: "European Union" },
      ],
    },
    {
      id: "plates",
      title: "The slow acceptance of moving continents",
      paragraphs: [
        "In 1912 the German meteorologist Alfred Wegener proposed that the continents had once been joined in a single landmass and had since drifted apart. His evidence was striking: the coastlines of South America and Africa fit together like puzzle pieces, and identical fossils and rock formations appear on both sides of the Atlantic. Nevertheless, most geologists rejected the idea for decades, chiefly because Wegener could not explain what force could push entire continents across the globe.",
        "The missing mechanism emerged from the ocean floor. After the Second World War, sonar surveys revealed an enormous underwater mountain chain, the Mid-Atlantic Ridge, running down the middle of the ocean. Around 1960 the American geologist Harry Hess suggested that new crust forms at such ridges, where molten rock rises from below, and then spreads outward on both sides.",
        "Confirmation came from magnetism. When lava cools, magnetic minerals inside it align with Earth's magnetic field, which reverses direction at irregular intervals over geological time. Ships towing magnetometers found the seafloor striped with alternating bands of normal and reversed magnetism, and the pattern on one side of a ridge mirrored the pattern on the other. Rock was being created at the centre and carried away symmetrically, like two conveyor belts.",
        "Today the theory of plate tectonics explains earthquakes, volcanoes and mountain ranges as consequences of a dozen or so large plates grinding past, beneath and into one another. They move only a few centimetres a year, roughly as fast as fingernails grow, yet over millions of years that is enough to open an ocean.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["Why Wegener was a careless scientist", "How continental drift was proposed, doubted, and finally explained by evidence from the seafloor", "How sonar was invented", "Why earthquakes happen in the Atlantic"], answer: 1 },
        { kind: "fact", q: "Why did most geologists reject Wegener's idea at first?", options: ["His fossils were fake", "He could not explain what force moved the continents", "The coastlines did not match", "Nobody had measured the Atlantic"], answer: 1 },
        { kind: "fact", q: "What did ships find on either side of a ridge?", options: ["Magnetic stripes in mirror-image patterns", "Rock with no magnetism at all", "Fossils of sea creatures", "Random patterns with no order"], answer: 0 },
        { kind: "inference", q: "Why were the mirrored stripes strong evidence for seafloor spreading?", options: ["They showed new rock forming at the ridge and moving away on both sides", "They proved Africa and South America were once joined", "They showed the ocean is getting shallower", "They proved fossils can move"], answer: 0 },
        { kind: "inference", q: "What does the comparison with fingernails suggest?", options: ["Plates move too slowly to matter", "Tiny yearly movements add up to huge changes over very long times", "Plates move faster than people think", "Plate movement can be felt every day"], answer: 1 },
      ],
      scans: [
        { q: "In what year did Wegener propose that continents drift?", find: "1912" },
        { q: "What is the underwater mountain chain in the Atlantic called?", find: "Mid-Atlantic Ridge" },
        { q: "Who suggested that new crust forms at ridges?", find: "Harry Hess" },
      ],
    },
    {
      id: "trade",
      title: "Comparative advantage",
      paragraphs: [
        "It seems obvious that a country should trade only if it can produce something more cheaply than its partners. In 1817 the British economist David Ricardo showed that this intuition is wrong. In his example, Portugal could produce both wine and cloth with less labour than England. Even so, he argued, both countries would be better off if Portugal concentrated on wine, England concentrated on cloth, and each traded for the other good.",
        "The key is opportunity cost: what you give up in order to make something. Portugal's advantage was far greater in wine than in cloth, so every worker it moved from cloth into wine produced a great deal of extra wine while sacrificing comparatively little cloth. For England the situation was reversed. Its workers were less productive at everything, but their disadvantage was smallest in cloth. When each country specialises in the good it gives up least to produce, total output of both goods rises, and trade allows the gains to be shared.",
        "The principle applies to individuals as well as nations. A senior lawyer who types faster than her assistant may still be wise to employ the assistant, because an hour she spends typing is an hour she cannot spend on work only she can do.",
        "Economists rarely agree as completely as they do on comparative advantage, yet the idea has limits. It describes the total gains from trade, not how those gains are distributed, and workers in industries that shrink under specialisation can suffer real and lasting losses even while the economy as a whole grows.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How Portugal became rich from wine", "Why trade can benefit both sides even when one is better at everything", "Why lawyers should type their own letters", "Why economists disagree about trade"], answer: 1 },
        { kind: "fact", q: "In Ricardo's example, which country could make both goods with less labour?", options: ["England", "Portugal", "Neither", "Both equally"], answer: 1 },
        { kind: "fact", q: "What is opportunity cost?", options: ["The price of a good in a shop", "What you give up in order to make something", "The cost of shipping goods abroad", "The wage paid to a worker"], answer: 1 },
        { kind: "inference", q: "Why should the lawyer employ an assistant even though she types faster?", options: ["Typing is bad for her health", "Her time is worth more on work only she can do", "Assistants always type better", "The law requires it"], answer: 1 },
        { kind: "inference", q: "What limit of the idea does the last paragraph point out?", options: ["It only works for wine and cloth", "The overall gains may not reach everyone; some workers lose out", "It makes economies shrink", "Most economists reject it"], answer: 1 },
      ],
      scans: [
        { q: "In what year did Ricardo make his argument?", find: "1817" },
        { q: "Who was the British economist?", find: "David Ricardo" },
        { q: "Whose assistant appears in the example about individuals?", find: "senior lawyer" },
      ],
    },
    {
      id: "gps",
      title: "Satellite navigation and Einstein",
      paragraphs: [
        "A satellite navigation receiver does not send any signal to the satellites overhead. It simply listens. Each of the roughly thirty GPS satellites, orbiting about 20,000 kilometres above Earth, continuously broadcasts its position and the precise time according to its onboard atomic clock. Because radio waves travel at the speed of light, the delay between when a signal was sent and when it arrives reveals how far away that satellite is.",
        "Distance to one satellite places the receiver somewhere on an imaginary sphere; distances to three narrow the possibilities to a single point. In practice a fourth satellite is required, because the inexpensive clock in a phone is far less accurate than an atomic clock, and the extra measurement allows the receiver to calculate its own clock error as well as its position.",
        "Such precision exposes effects that are invisible in everyday life. According to Einstein's special relativity, the satellites' speed makes their clocks tick slightly slower than clocks on the ground. General relativity predicts the opposite effect for their altitude: in weaker gravity, clocks tick faster. The second effect is larger, so overall the satellite clocks gain about 38 microseconds per day.",
        "That sounds trivial, but light travels nearly 300 metres in a microsecond. If engineers ignored relativity, calculated positions would drift by roughly ten kilometres every day. Instead, the clocks are adjusted before launch to run slightly slow, so that once in orbit they keep time with clocks on Earth: a daily, practical confirmation of a theory often assumed to matter only to physicists.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How satellite navigation works and why it must correct for relativity", "How to build an atomic clock", "Why phones lose signal in tunnels", "The life of Albert Einstein"], answer: 0 },
        { kind: "fact", q: "Why does a receiver need a fourth satellite?", options: ["To send its own signal", "To work out the error in its own cheaper clock", "Because one satellite is always broken", "To measure the weather"], answer: 1 },
        { kind: "fact", q: "Overall, how much time do the satellite clocks gain each day?", options: ["About 38 seconds", "About 38 microseconds", "About 7 minutes", "Nothing at all"], answer: 1 },
        { kind: "inference", q: "Why does such a tiny time error matter so much?", options: ["Signals travel so fast that small time errors become large distance errors", "Satellites need exact time to stay in orbit", "Phones cannot display microseconds", "The satellites would collide"], answer: 0 },
        { kind: "inference", q: "What does the writer suggest by calling navigation a daily confirmation of relativity?", options: ["Relativity has no real use", "The theory is tested and relied on every day in ordinary technology", "Satellite navigation proves Einstein wrong", "Physicists invented satellite navigation"], answer: 1 },
      ],
      scans: [
        { q: "How high do the satellites orbit?", find: "20,000 kilometres" },
        { q: "How far does light travel in a microsecond?", find: "300 metres" },
        { q: "Which theory says the satellites' speed slows their clocks?", find: "special relativity" },
      ],
    },
    {
      id: "sky",
      title: "Why the sky is blue",
      paragraphs: [
        "Sunlight looks white, but it is a mixture of every colour of the visible spectrum, each corresponding to a different wavelength. On its way to the ground, this light collides with the nitrogen and oxygen molecules that make up most of the atmosphere. These molecules are far smaller than the wavelength of visible light, and in that situation light is scattered in all directions in a way first described mathematically by the British physicist John William Strutt, later Lord Rayleigh, in 1871.",
        "The crucial feature of Rayleigh scattering is how strongly it depends on wavelength: the amount of scattering rises with the inverse fourth power of the wavelength. Blue light, at roughly 450 nanometres, is therefore scattered several times more than red light at around 700 nanometres. Wherever you look in a clear sky, you are seeing sunlight that air molecules have redirected towards you, and that redirected light is dominated by shorter wavelengths.",
        "If shorter wavelengths scatter most, one might expect a violet sky. Two factors prevent it. Sunlight contains less violet than blue to begin with, and human eyes are considerably less sensitive to violet, so the mixture we perceive is sky blue.",
        "The same physics explains red sunsets. When the Sun is low, its light crosses far more atmosphere before reaching us, and by the time it arrives most of the blue has been scattered out of the direct beam, leaving the oranges and reds.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["Why the sky is blue and sunsets are red", "How rainbows form", "Why the Sun is yellow", "How eyes see colour"], answer: 0 },
        { kind: "fact", q: "What mainly scatters sunlight in a clear sky?", options: ["Water droplets", "Nitrogen and oxygen molecules", "Dust from deserts", "The ozone layer"], answer: 1 },
        { kind: "fact", q: "Why is the sky not violet?", options: ["Violet light is not scattered at all", "Sunlight has less violet and our eyes are less sensitive to it", "Violet is absorbed by the oceans", "Clouds block violet light"], answer: 1 },
        { kind: "inference", q: "If scattering depended only weakly on wavelength, the sky would probably look…", options: ["Bluer", "Closer to white", "Bright red", "Completely black"], answer: 1 },
        { kind: "inference", q: "Why is the sunset red rather than blue?", options: ["Low sunlight crosses more air, so most blue is scattered away before it reaches you", "The Sun gives off more red light in the evening", "Red light is scattered most", "Evening air contains no oxygen"], answer: 0 },
      ],
      scans: [
        { q: "In what year was this scattering first described?", find: "1871" },
        { q: "What is the wavelength of blue light in the passage?", find: "450 nanometres" },
        { q: "What was Lord Rayleigh's real name?", find: "John William Strutt" },
      ],
    },
    {
      id: "bias",
      title: "Looking only for agreement",
      paragraphs: [
        "In 1960 the British psychologist Peter Wason gave volunteers a simple puzzle. He told them that the sequence 2, 4, 6 obeyed a rule he had in mind, and asked them to discover the rule by proposing sequences of their own. After each proposal he said whether it fitted the rule, and when they felt confident, they announced their answer.",
        "Most people quickly formed a hypothesis, such as numbers increasing by two, and then tested it with sequences like 8, 10, 12 or 20, 22, 24. Every one fitted, their confidence grew, and many announced their hypothesis as the rule. It was wrong. Wason's rule was simply any three numbers in ascending order. The volunteers had searched almost exclusively for examples that would confirm their idea, and rarely proposed one, such as 1, 2, 3 or 6, 4, 2, that could have shown it to be false.",
        "This tendency, now called confirmation bias, appears far beyond the laboratory. People tend to seek out news that supports what they already believe, remember evidence that fits their views more readily than evidence that contradicts them, and interpret ambiguous information as support for their existing position.",
        "Scientists guard against it deliberately. A well-designed experiment specifies in advance what result would show the hypothesis to be wrong, and techniques such as blind testing keep researchers' expectations from shaping what they observe. For readers, the practical lesson is to ask of any argument not only what supports it, but what would convince you it is false.",
      ],
      questions: [
        { kind: "gist", q: "What is the passage mainly about?", options: ["How a simple puzzle revealed our habit of seeking only evidence that agrees with us", "How to solve number sequences", "Why scientists avoid the news", "Why ascending numbers are special"], answer: 0 },
        { kind: "fact", q: "What was Wason's actual rule?", options: ["Numbers increasing by two", "Even numbers only", "Any three numbers in ascending order", "Numbers that add up to 12"], answer: 2 },
        { kind: "fact", q: "What do scientists use to stop expectations shaping what they observe?", options: ["Blind testing", "Larger numbers", "Reading the news", "Announcing results early"], answer: 0 },
        { kind: "inference", q: "Why did testing 8, 10, 12 not help the volunteers find the rule?", options: ["It fitted both their idea and the real rule, so it could not tell them apart", "Large numbers were not allowed", "Wason gave them wrong answers", "It did not fit the real rule"], answer: 0 },
        { kind: "inference", q: "A reader who wants to avoid confirmation bias should…", options: ["Read only sources they agree with", "Look for evidence that could prove their view wrong", "Trust their first impression", "Avoid reading arguments at all"], answer: 1 },
      ],
      scans: [
        { q: "In what year was the puzzle given?", find: "1960" },
        { q: "Who designed the number puzzle?", find: "Peter Wason" },
        { q: "What name is given to this tendency?", find: "confirmation bias" },
      ],
    },
  ];

  const api = { PASSAGES, ADVANCED_PASSAGES };
  if (typeof window !== "undefined") window.SpellReadingPassages = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
