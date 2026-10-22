/**
 * Reference data written to SQLite on first start. The API serves everything from the
 * database; nothing here is read at request time.
 */
type Row = [code: string, label: string, parent?: string];

export const LOOKUPS: Record<string, Row[]> = {
  patientCategory: [['general', 'General'], ['staff', 'Staff'], ['staffDependant', 'Staff dependant'], ['vip', 'VIP']],
  identityAvailability: [['known', 'Known'], ['unknown', 'Not disclosed'], ['unidentified', 'Unidentified']],
  identityUnavailableReason: [
    ['unconscious', 'Patient is unconscious'],
    ['emergency', 'Emergency, details to follow'],
    ['refused', 'Patient declined to share'],
    ['minorUnaccompanied', 'Unaccompanied minor'],
    ['mentalStatus', 'Unable to communicate'],
    ['other', 'Other reason'],
  ],
  title: [['mr', 'Mr'], ['mrs', 'Mrs'], ['ms', 'Ms'], ['miss', 'Miss'], ['master', 'Master'], ['baby', 'Baby'], ['dr', 'Dr'], ['prof', 'Prof'], ['rev', 'Rev'], ['sr', 'Sr']],
  dobPrecision: [['exact', 'Exact date'], ['yearMonth', 'Month and year'], ['year', 'Year only'], ['age', 'Approximate age']],
  month: [['1', 'January'], ['2', 'February'], ['3', 'March'], ['4', 'April'], ['5', 'May'], ['6', 'June'], ['7', 'July'], ['8', 'August'], ['9', 'September'], ['10', 'October'], ['11', 'November'], ['12', 'December']],
  administrativeSex: [['male', 'Male'], ['female', 'Female'], ['other', 'Other'], ['unknown', 'Unknown']],
  genderIdentity: [['man', 'Man'], ['woman', 'Woman'], ['transMan', 'Transgender man'], ['transWoman', 'Transgender woman'], ['nonBinary', 'Non-binary'], ['other', 'Other'], ['notDisclosed', 'Prefers not to say']],
  pronoun: [['heHim', 'He / him'], ['sheHer', 'She / her'], ['theyThem', 'They / them'], ['other', 'Other'], ['notDisclosed', 'Prefers not to say']],
  maritalStatus: [['single', 'Single'], ['married', 'Married'], ['widowed', 'Widowed'], ['divorced', 'Divorced'], ['separated', 'Separated'], ['notDisclosed', 'Prefers not to say']],
  nationality: [['IN', 'Indian'], ['AE', 'Emirati'], ['BD', 'Bangladeshi'], ['LK', 'Sri Lankan'], ['NP', 'Nepali'], ['MV', 'Maldivian'], ['OM', 'Omani'], ['SA', 'Saudi'], ['GB', 'British'], ['US', 'American'], ['OTHER', 'Other']],
  religion: [['hindu', 'Hindu'], ['muslim', 'Muslim'], ['christian', 'Christian'], ['sikh', 'Sikh'], ['buddhist', 'Buddhist'], ['jain', 'Jain'], ['none', 'No religion'], ['other', 'Other'], ['notDisclosed', 'Prefers not to say']],
  race: [['asian', 'Asian'], ['black', 'Black'], ['white', 'White'], ['mixed', 'Mixed'], ['other', 'Other'], ['notDisclosed', 'Prefers not to say']],
  ethnicity: [['malayali', 'Malayali'], ['tamil', 'Tamil'], ['kannadiga', 'Kannadiga'], ['telugu', 'Telugu'], ['bengali', 'Bengali'], ['marathi', 'Marathi'], ['punjabi', 'Punjabi'], ['gujarati', 'Gujarati'], ['hindiBelt', 'Hindi-speaking'], ['other', 'Other']],
  occupation: [
    ['salaried', 'Salaried employee'], ['business', 'Business owner'], ['professional', 'Professional'], ['govt', 'Government employee'],
    ['agriculture', 'Agriculture'], ['fisheries', 'Fisheries'], ['labour', 'Daily wage worker'], ['homemaker', 'Homemaker'],
    ['student', 'Student'], ['retired', 'Retired'], ['unemployed', 'Not working'], ['abroad', 'Working abroad'], ['other', 'Other'],
  ],
  educationLevel: [['none', 'No formal education'], ['primary', 'Primary school'], ['secondary', 'Secondary school'], ['higherSecondary', 'Higher secondary'], ['diploma', 'Diploma'], ['graduate', 'Graduate'], ['postgraduate', 'Postgraduate'], ['doctorate', 'Doctorate']],
  contactMethod: [['call', 'Call'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'], ['email', 'Email']],
  language: [['ml', 'Malayalam'], ['en', 'English'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['kn', 'Kannada'], ['te', 'Telugu'], ['ar', 'Arabic'], ['bn', 'Bengali'], ['mr', 'Marathi']],
  relationship: [['spouse', 'Spouse'], ['father', 'Father'], ['mother', 'Mother'], ['son', 'Son'], ['daughter', 'Daughter'], ['brother', 'Brother'], ['sister', 'Sister'], ['guardian', 'Legal guardian'], ['friend', 'Friend'], ['neighbour', 'Neighbour'], ['employer', 'Employer'], ['other', 'Other']],
  addressType: [['home', 'Home'], ['work', 'Work'], ['temporary', 'Temporary']],
  state: [
    ['KL', 'Kerala'], ['TN', 'Tamil Nadu'], ['KA', 'Karnataka'], ['AP', 'Andhra Pradesh'], ['TG', 'Telangana'], ['MH', 'Maharashtra'],
    ['GA', 'Goa'], ['GJ', 'Gujarat'], ['DL', 'Delhi'], ['UP', 'Uttar Pradesh'], ['WB', 'West Bengal'], ['OD', 'Odisha'], ['BR', 'Bihar'],
    ['RJ', 'Rajasthan'], ['MP', 'Madhya Pradesh'], ['PB', 'Punjab'], ['HR', 'Haryana'], ['AS', 'Assam'], ['PY', 'Puducherry'], ['LD', 'Lakshadweep'],
  ],
  country: [['IN', 'India'], ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['OM', 'Oman'], ['QA', 'Qatar'], ['KW', 'Kuwait'], ['BH', 'Bahrain'], ['LK', 'Sri Lanka'], ['MV', 'Maldives'], ['BD', 'Bangladesh'], ['NP', 'Nepal'], ['GB', 'United Kingdom'], ['US', 'United States'], ['SG', 'Singapore'], ['AU', 'Australia'], ['CA', 'Canada']],
  idDocumentType: [['aadhaar', 'Aadhaar'], ['pan', 'PAN card'], ['passport', 'Passport'], ['voter', 'Voter ID'], ['dl', 'Driving licence']],
  payerType: [['self', 'Self pay'], ['insurance', 'Insurance'], ['corporate', 'Corporate'], ['government', 'Government scheme']],
  insurer: [['star', 'Star Health'], ['hdfcErgo', 'HDFC ERGO'], ['icici', 'ICICI Lombard'], ['niva', 'Niva Bupa'], ['care', 'Care Health'], ['nia', 'New India Assurance'], ['uiic', 'United India Insurance'], ['oriental', 'Oriental Insurance'], ['bajaj', 'Bajaj Allianz'], ['aditya', 'Aditya Birla Health']],
  tpa: [['mediAssist', 'Medi Assist'], ['paramount', 'Paramount Health'], ['vidal', 'Vidal Health'], ['mdIndia', 'MD India'], ['healthIndia', 'Health India'], ['fhpl', 'Family Health Plan']],
  policyRelation: [['self', 'Self'], ['spouse', 'Spouse'], ['child', 'Child'], ['parent', 'Parent'], ['other', 'Other']],
  corporate: [['infopark', 'Infopark Kochi tenants'], ['cial', 'Cochin International Airport'], ['kseb', 'KSEB'], ['cochinShipyard', 'Cochin Shipyard'], ['bpcl', 'BPCL Kochi Refinery'], ['technopark', 'Technopark Trivandrum']],
  govtScheme: [['pmjay', 'PM-JAY (Ayushman Bharat)'], ['karunya', 'Karunya Arogya Suraksha (KASP)'], ['cghs', 'CGHS'], ['echs', 'ECHS'], ['esi', 'ESI'], ['medisep', 'MEDISEP']],
  bloodGroup: [['A+', 'A+'], ['A-', 'A−'], ['B+', 'B+'], ['B-', 'B−'], ['AB+', 'AB+'], ['AB-', 'AB−'], ['O+', 'O+'], ['O-', 'O−'], ['bombay', 'Bombay (hh)']],
  allergyStatus: [['nka', 'No known allergies'], ['known', 'Has allergies'], ['unknown', 'Not yet asked']],
  allergen: [
    ['penicillin', 'Penicillin'], ['sulfa', 'Sulfonamides'], ['nsaids', 'NSAIDs (ibuprofen, diclofenac)'], ['aspirin', 'Aspirin'],
    ['cephalosporins', 'Cephalosporins'], ['contrast', 'Iodine contrast'], ['latex', 'Latex'], ['peanut', 'Peanuts'],
    ['shellfish', 'Shellfish'], ['egg', 'Egg'], ['milk', 'Milk'], ['dust', 'Dust mites'], ['pollen', 'Pollen'], ['insect', 'Insect stings'],
  ],
  chronicCondition: [
    ['diabetes2', 'Type 2 diabetes'], ['diabetes1', 'Type 1 diabetes'], ['hypertension', 'Hypertension'], ['cad', 'Coronary artery disease'],
    ['asthma', 'Asthma'], ['copd', 'COPD'], ['ckd', 'Chronic kidney disease'], ['thyroid', 'Thyroid disorder'], ['epilepsy', 'Epilepsy'],
    ['arthritis', 'Arthritis'], ['cancer', 'Cancer'], ['hiv', 'HIV'], ['tb', 'Tuberculosis'], ['depression', 'Depression'], ['pregnancy', 'Currently pregnant'],
  ],
  registrationType: [['op', 'Outpatient'], ['ip', 'Inpatient'], ['er', 'Emergency'], ['daycare', 'Day care']],
  priority: [['routine', 'Routine'], ['urgent', 'Urgent']],
  department: [
    ['gm', 'General Medicine'], ['card', 'Cardiology'], ['ortho', 'Orthopaedics'], ['peds', 'Paediatrics'], ['obg', 'Obstetrics & Gynaecology'],
    ['ent', 'ENT'], ['derm', 'Dermatology'], ['neuro', 'Neurology'], ['nephro', 'Nephrology'], ['ophth', 'Ophthalmology'], ['emer', 'Emergency Medicine'], ['gs', 'General Surgery'],
  ],
  doctor: [
    ['d01', 'Dr Anil Kumar', 'gm'], ['d02', 'Dr Rekha Menon', 'gm'], ['d03', 'Dr Joseph Mathew', 'card'], ['d04', 'Dr Sreeja Nair', 'card'],
    ['d05', 'Dr Faisal Rahman', 'ortho'], ['d06', 'Dr Vinod Pillai', 'ortho'], ['d07', 'Dr Asha George', 'peds'], ['d08', 'Dr Meera Krishnan', 'peds'],
    ['d09', 'Dr Lakshmi Varma', 'obg'], ['d10', 'Dr Susan Thomas', 'obg'], ['d11', 'Dr Hari Shankar', 'ent'], ['d12', 'Dr Nisha Paul', 'derm'],
    ['d13', 'Dr Ravi Iyer', 'neuro'], ['d14', 'Dr Ameer Haneef', 'nephro'], ['d15', 'Dr Divya Raj', 'ophth'], ['d16', 'Dr Manoj Das', 'emer'],
    ['d17', 'Dr Sunil Kurian', 'gs'], ['d18', 'Dr Fathima Beevi', 'gs'],
  ],
  referralSource: [['walkin', 'Walk-in'], ['doctor', 'Doctor referral'], ['hospital', 'Hospital transfer'], ['online', 'Online booking'], ['camp', 'Health camp'], ['ambulance', 'Ambulance']],
  paymentMode: [['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['insurance', 'Billed to insurer'], ['waived', 'Fee waived']],
  consentGivenBy: [['patient', 'Patient'], ['guardian', 'Guardian'], ['relative', 'Relative']],
  consentCapture: [['digital', 'Digital signature'], ['paper', 'Paper form']],
};

export const ORGANIZATION = { id: 1, code: 'SPH', name: 'Spectrum Healthcare India Private Ltd', patientPrefix: 'SPH' };

export const BRANCHES = [
  { id: 1, code: 'KCH', name: 'Spectrum Kochi Hospital', city: 'Kochi', mrnPrefix: 'KCH' },
  { id: 2, code: 'TVM', name: 'Spectrum Trivandrum Hospital', city: 'Thiruvananthapuram', mrnPrefix: 'TVM' },
  { id: 3, code: 'CLT', name: 'Spectrum Calicut Clinic', city: 'Kozhikode', mrnPrefix: 'CLT' },
];

export const USER = {
  id: 1,
  email: 'kl.hsp01.receptionist01@spectrum.health',
  name: 'Keerthana Lal',
  role: 'Front desk',
};

export const PINCODES: [pin: string, city: string, district: string, state: string][] = [
  ['682001', 'Fort Kochi', 'Ernakulam', 'KL'], ['682011', 'Ernakulam', 'Ernakulam', 'KL'], ['682016', 'Kochi', 'Ernakulam', 'KL'],
  ['682017', 'Kaloor', 'Ernakulam', 'KL'], ['682018', 'Elamakkara', 'Ernakulam', 'KL'], ['682020', 'Kadavanthra', 'Ernakulam', 'KL'],
  ['682024', 'Edappally', 'Ernakulam', 'KL'], ['682030', 'Kakkanad', 'Ernakulam', 'KL'], ['682035', 'Ernakulam South', 'Ernakulam', 'KL'],
  ['683101', 'Aluva', 'Ernakulam', 'KL'], ['683572', 'Angamaly', 'Ernakulam', 'KL'], ['686001', 'Kottayam', 'Kottayam', 'KL'],
  ['688001', 'Alappuzha', 'Alappuzha', 'KL'], ['680001', 'Thrissur', 'Thrissur', 'KL'], ['695001', 'Thiruvananthapuram', 'Thiruvananthapuram', 'KL'],
  ['695014', 'Pattom', 'Thiruvananthapuram', 'KL'], ['673001', 'Kozhikode', 'Kozhikode', 'KL'], ['676505', 'Malappuram', 'Malappuram', 'KL'],
  ['691001', 'Kollam', 'Kollam', 'KL'], ['670001', 'Kannur', 'Kannur', 'KL'], ['600001', 'Chennai', 'Chennai', 'TN'],
  ['641001', 'Coimbatore', 'Coimbatore', 'TN'], ['560001', 'Bengaluru', 'Bengaluru Urban', 'KA'], ['575001', 'Mangaluru', 'Dakshina Kannada', 'KA'],
  ['400001', 'Mumbai', 'Mumbai', 'MH'], ['110001', 'New Delhi', 'New Delhi', 'DL'], ['500001', 'Hyderabad', 'Hyderabad', 'TG'],
];
