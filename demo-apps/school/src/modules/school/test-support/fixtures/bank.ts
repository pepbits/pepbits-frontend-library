import type { QuizQuestion } from "../../lib/types";

type Q = Omit<QuizQuestion, "id" | "points">;

/** Real question content so quizzes and live polls are usable in demos. */
export const QUESTION_BANK: Record<string, Q[]> = {
  "sub-math": [
    { text: "What is the value of x if 3x − 7 = 11?", options: ["4", "6", "5", "18"], answer: 1, explanation: "3x = 18, so x = 6." },
    { text: "The sum of the interior angles of a hexagon is:", options: ["540°", "720°", "900°", "360°"], answer: 1, explanation: "(n − 2) × 180 = 4 × 180 = 720°." },
    { text: "Which of these is an irrational number?", options: ["0.75", "√16", "√2", "22/7"], answer: 2 },
    { text: "The roots of x² − 5x + 6 = 0 are:", options: ["2 and 3", "−2 and −3", "1 and 6", "−1 and 6"], answer: 0 },
    { text: "sin 30° equals:", options: ["√3/2", "1/2", "1", "1/√2"], answer: 1 },
    { text: "The slope of the line y = −2x + 5 is:", options: ["5", "2", "−2", "−5"], answer: 2 },
    { text: "If the probability of an event is 0.3, the probability it does not happen is:", options: ["0.3", "0.7", "1.3", "0"], answer: 1 },
    { text: "The area of a circle with radius 7 cm (π ≈ 22/7) is:", options: ["154 cm²", "44 cm²", "49 cm²", "308 cm²"], answer: 0 },
  ],
  "sub-phy": [
    { text: "The SI unit of force is:", options: ["Joule", "Newton", "Watt", "Pascal"], answer: 1 },
    { text: "An object moving at constant velocity has an acceleration of:", options: ["9.8 m/s²", "Zero", "Equal to its speed", "Increasing"], answer: 1 },
    { text: "Which colour of visible light has the longest wavelength?", options: ["Violet", "Green", "Blue", "Red"], answer: 3 },
    { text: "Ohm's law relates:", options: ["Force and mass", "Voltage, current and resistance", "Pressure and volume", "Energy and power"], answer: 1 },
    { text: "Kinetic energy of a 2 kg mass moving at 3 m/s is:", options: ["6 J", "9 J", "18 J", "3 J"], answer: 1, explanation: "½ × 2 × 3² = 9 J." },
    { text: "Sound cannot travel through:", options: ["Water", "Steel", "Vacuum", "Air"], answer: 2 },
  ],
  "sub-chem": [
    { text: "The atomic number of carbon is:", options: ["12", "6", "8", "14"], answer: 1 },
    { text: "A solution with pH 3 is:", options: ["Neutral", "Basic", "Acidic", "Buffer"], answer: 2 },
    { text: "Which gas is produced when zinc reacts with dilute hydrochloric acid?", options: ["Oxygen", "Chlorine", "Hydrogen", "Carbon dioxide"], answer: 2 },
    { text: "NaCl is held together by:", options: ["Covalent bonds", "Ionic bonds", "Metallic bonds", "Hydrogen bonds"], answer: 1 },
    { text: "Avogadro's number is approximately:", options: ["6.02 × 10²³", "3.0 × 10⁸", "9.81", "1.6 × 10⁻¹⁹"], answer: 0 },
    { text: "Rusting of iron is an example of:", options: ["Reduction", "Oxidation", "Sublimation", "Neutralisation"], answer: 1 },
  ],
  "sub-bio": [
    { text: "The powerhouse of the cell is the:", options: ["Nucleus", "Ribosome", "Mitochondrion", "Golgi body"], answer: 2 },
    { text: "Photosynthesis takes place in the:", options: ["Chloroplast", "Vacuole", "Cell wall", "Nucleus"], answer: 0 },
    { text: "Human blood cells that fight infection are:", options: ["Red blood cells", "Platelets", "White blood cells", "Plasma"], answer: 2 },
    { text: "DNA stands for:", options: ["Deoxyribonucleic acid", "Dinitro acid", "Dual nucleic acid", "Deoxyribose nitrate"], answer: 0 },
    { text: "Which organ produces insulin?", options: ["Liver", "Pancreas", "Kidney", "Stomach"], answer: 1 },
    { text: "The basic unit of heredity is the:", options: ["Cell", "Gene", "Tissue", "Protein"], answer: 1 },
  ],
  "sub-eng": [
    { text: "Choose the correctly punctuated sentence:", options: ["Its raining, isnt it?", "It's raining, isn't it?", "Its' raining, isn't it?", "It's raining isn't it."], answer: 1 },
    { text: "'The wind whispered through the trees' is an example of:", options: ["Simile", "Personification", "Hyperbole", "Alliteration"], answer: 1 },
    { text: "The antonym of 'benevolent' is:", options: ["Kind", "Generous", "Malevolent", "Charitable"], answer: 2 },
    { text: "Which word is a conjunction?", options: ["Quickly", "Although", "Beneath", "Bright"], answer: 1 },
    { text: "A story's turning point is called the:", options: ["Exposition", "Climax", "Resolution", "Prologue"], answer: 1 },
  ],
  "sub-cs": [
    { text: "Binary 1011 equals decimal:", options: ["9", "10", "11", "13"], answer: 2 },
    { text: "Which data structure works on a first-in, first-out basis?", options: ["Stack", "Queue", "Tree", "Graph"], answer: 1 },
    { text: "HTML is primarily used to:", options: ["Style pages", "Structure web content", "Query databases", "Compile programs"], answer: 1 },
    { text: "Time complexity of binary search on a sorted array is:", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], answer: 1 },
    { text: "Which of these is not a programming language?", options: ["Python", "Java", "HTTP", "Rust"], answer: 2 },
    { text: "A loop that never ends is called:", options: ["Recursive", "Nested", "Infinite", "Conditional"], answer: 2 },
  ],
  "sub-hist": [
    { text: "The Industrial Revolution began in:", options: ["France", "Britain", "Germany", "USA"], answer: 1 },
    { text: "The Berlin Wall fell in:", options: ["1985", "1989", "1991", "1979"], answer: 1 },
    { text: "Who was the first Secretary-General of the United Nations?", options: ["Kofi Annan", "Trygve Lie", "Dag Hammarskjöld", "U Thant"], answer: 1 },
    { text: "The Magna Carta was sealed in:", options: ["1066", "1215", "1492", "1605"], answer: 1 },
  ],
};
