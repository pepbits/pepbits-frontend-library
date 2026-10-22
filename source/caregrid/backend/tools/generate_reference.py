# Regenerates backend/src/db/reference.sql (resources, rosters, 185 appointment types and their resource requirements, demo patients).
# Run from the repository root: python3 backend/tools/generate_reference.py
import os
P1="Single provider"; P2="Provider + equipment"; P3="Machine-based"; P4="Chair / bed / room-based"
P5="Team-based"; P6="Team + machine"; P7="Multi-station (package)"
rows = [
# Outpatient
("Outpatient","New patient consultation","Clinic / Hospital OPD","In-person","Physician","Person","Nurse (vitals)","Consultation room","BP monitor, weighing scale",P1,20,"N","Longer slot than follow-up"),
("Outpatient","Follow-up visit","Clinic / Hospital OPD","In-person","Physician","Person","Nurse (vitals)","Consultation room","BP monitor",P1,10,"N",""),
("Outpatient","Specialist referral consultation","Hospital OPD","In-person","Specialist","Person","Nurse","Consultation room","Specialty-specific",P1,20,"N","Needs referral letter"),
("Outpatient","Second opinion","Hospital OPD","In-person / Virtual","Senior consultant","Person","","Consultation room","Imaging viewer (PACS)",P1,30,"N","Prior reports and images required"),
("Outpatient","Walk-in visit","Clinic","In-person","General practitioner","Person","Triage nurse","Consultation room","",P1,15,"N","Unscheduled, queue-based"),
("Outpatient","Chronic disease review (diabetes, BP, asthma)","Clinic / Hospital OPD","In-person","Physician","Person","Nurse educator","Consultation room","Glucometer, BP monitor, peak flow meter",P1,20,"Y",""),
("Outpatient","Results discussion","Clinic / Hospital OPD","In-person / Virtual","Physician","Person","","Consultation room","",P1,10,"N",""),
("Outpatient","Minor procedure in clinic (cyst excision, IUD insertion)","Clinic","In-person","Physician","Person","Nurse assistant","Procedure room","Procedure trolley, sterile set",P5,30,"N","Consent required"),
("Outpatient","Nurse-led clinic","Clinic","In-person","Nurse","Person","","Nurse station","BP monitor",P1,15,"Y",""),
("Outpatient","Group visit / shared medical appointment","Clinic","In-person","Physician","Person","Health educator","Group room","Projector",P4,60,"Y","Capacity = seats"),
# Specialty
("Specialty clinic","Ophthalmology consultation","Hospital OPD / Eye clinic","In-person","Ophthalmologist","Person","Optometrist / ophthalmic technician","Dark room + consult room","Slit lamp, tonometer, autorefractor",P6,30,"N","Pupil dilation adds waiting time"),
("Specialty clinic","ENT consultation","Hospital OPD","In-person","ENT surgeon","Person","","ENT room","ENT chair, rigid/flexible endoscope",P2,20,"N",""),
("Specialty clinic","Cardiology consultation","Hospital OPD","In-person","Cardiologist","Person","Nurse","Consultation room","ECG machine",P2,20,"N","ECG often done before consult"),
("Specialty clinic","Dermatology consultation","Hospital OPD","In-person","Dermatologist","Person","","Consultation room","Dermatoscope",P2,15,"N",""),
("Specialty clinic","Obstetrics / gynecology consultation","Hospital OPD","In-person","OB/GYN","Person","Female chaperone / nurse","Exam room with couch","Ultrasound (optional), speculum set",P5,20,"N","Chaperone required for exam"),
("Specialty clinic","Pediatric consultation","Hospital OPD","In-person","Pediatrician","Person","Nurse","Child-friendly room","Infant scale, length board",P1,15,"N",""),
("Specialty clinic","Oncology consultation","Hospital OPD","In-person","Medical oncologist","Person","Oncology nurse","Consultation room","",P1,30,"N",""),
("Specialty clinic","Orthopedic consultation","Hospital OPD","In-person","Orthopedic surgeon","Person","","Consultation room","X-ray viewer",P1,15,"N","X-ray often booked same day"),
("Specialty clinic","Fracture / plaster clinic","Hospital OPD","In-person","Orthopedic surgeon","Person","Plaster technician","Plaster room","Cast saw, plaster materials",P5,30,"N",""),
# Lab
("Laboratory","Blood collection (phlebotomy)","Hospital / Lab / Clinic","In-person","Collection chair","Chair","Phlebotomist","Sample collection room","Collection chair, tourniquet, centrifuge",P4,10,"N","Capacity = chairs x phlebotomists"),
("Laboratory","Fasting blood test","Hospital / Lab","In-person","Collection chair","Chair","Phlebotomist","Sample collection room","Collection chair",P4,10,"N","Restrict to early-morning slots"),
("Laboratory","Glucose tolerance test","Hospital / Lab","In-person","Collection chair + waiting seat","Chair","Phlebotomist","Collection room + waiting bay","Glucometer",P4,150,"N","Patient occupies a seat 2-3 hrs; multiple draws"),
("Laboratory","Urine / stool sample collection","Hospital / Lab","In-person","Sample washroom","Room","","Sample washroom","Sterile containers",P4,10,"N",""),
("Laboratory","Pediatric blood collection","Hospital / Lab","In-person","Pediatric phlebotomist","Person","Assistant to hold child","Pediatric collection room","Butterfly needles, distraction aids",P5,15,"N",""),
("Laboratory","Bone marrow aspiration / biopsy","Hospital","In-person","Hematologist","Person","Nurse","Procedure room","Biopsy needle set",P5,45,"N","Consent; sedation sometimes"),
("Laboratory","FNAC (fine needle aspiration)","Hospital / Lab","In-person","Pathologist","Person","Lab technician","Procedure room","Ultrasound (if guided), microscope",P6,30,"N",""),
("Laboratory","Genetic counseling / testing","Hospital","In-person / Virtual","Genetic counselor","Person","","Consultation room","",P1,45,"N",""),
("Laboratory","Drug / alcohol screening","Lab / Occupational health","In-person","Collection staff","Person","Same-gender witness","Sample washroom","Breathalyzer, collection kit",P5,15,"N","Chain-of-custody documentation"),
# Radiology
("Radiology","X-ray","Hospital / Diagnostic centre","In-person","X-ray machine","Machine","Radiographer","X-ray room","X-ray unit",P3,10,"N",""),
("Radiology","Ultrasound","Hospital / Diagnostic centre","In-person","Ultrasound machine","Machine","Sonologist / radiologist","Ultrasound room","Ultrasound unit",P3,20,"N","Some need full bladder or fasting"),
("Radiology","Doppler ultrasound","Hospital / Diagnostic centre","In-person","Ultrasound machine (Doppler)","Machine","Radiologist","Ultrasound room","Doppler-capable ultrasound",P3,30,"N",""),
("Radiology","CT scan (plain)","Hospital / Diagnostic centre","In-person","CT scanner","Machine","Radiographer","CT suite","CT scanner",P3,15,"N",""),
("Radiology","CT scan with contrast","Hospital / Diagnostic centre","In-person","CT scanner","Machine","Radiographer, nurse (IV line), radiologist","CT suite + prep bay","CT scanner, pressure injector",P6,30,"N","Creatinine check; allergy screen"),
("Radiology","MRI","Hospital / Diagnostic centre","In-person","MRI scanner","Machine","MRI technologist","MRI suite","MRI scanner",P3,45,"N","Metal / implant screening"),
("Radiology","MRI under sedation / anesthesia","Hospital","In-person","MRI scanner","Machine","Anesthetist, nurse, MRI technologist","MRI suite + recovery bay","MRI-compatible anesthesia machine and monitor",P6,90,"N","Children, claustrophobic patients"),
("Radiology","Mammography","Hospital / Diagnostic centre","In-person","Mammography unit","Machine","Female radiographer","Mammography room","Mammography unit",P3,20,"N",""),
("Radiology","DEXA (bone density)","Hospital / Diagnostic centre","In-person","DEXA scanner","Machine","Technologist","DEXA room","DEXA scanner",P3,15,"N",""),
("Radiology","PET-CT","Hospital","In-person","PET-CT scanner","Machine","Nuclear medicine technologist, physician","Uptake room + PET suite","PET-CT scanner, radioisotope (FDG)",P6,120,"N","Isotope must be ordered for slot; fasting"),
("Radiology","Nuclear medicine scan (bone, thyroid, renal)","Hospital","In-person","Gamma camera","Machine","Nuclear medicine technologist","Injection room + scan room","Gamma camera, radioisotope",P3,180,"N","Gap between injection and scan"),
("Radiology","Fluoroscopy (barium studies)","Hospital","In-person","Fluoroscopy unit","Machine","Radiologist, radiographer","Fluoroscopy room","Fluoroscopy unit, contrast",P6,45,"N",""),
("Radiology","Interventional radiology procedure","Hospital","In-person","IR / angiography suite","Machine","Interventional radiologist, nurse, radiographer, anesthetist (if needed)","IR suite + recovery bed","Angiography system, C-arm",P6,90,"N","Post-procedure bed needed"),
# Other diagnostics
("Other diagnostics","ECG","Hospital / Clinic","In-person","ECG machine","Machine","ECG technician","ECG room","ECG machine",P3,10,"N",""),
("Other diagnostics","Echocardiogram","Hospital","In-person","Echo machine","Machine","Cardiologist / echo technician","Echo room","Echocardiography unit",P3,30,"N",""),
("Other diagnostics","Treadmill stress test (TMT)","Hospital","In-person","TMT machine","Machine","Technician, supervising cardiologist","Stress test room","Treadmill, defibrillator, crash cart",P6,45,"N","Doctor must be present"),
("Other diagnostics","Holter / ambulatory BP fitting","Hospital","In-person","Holter / ABPM device","Machine","Technician","ECG room","Holter recorder",P3,15,"N","Device unavailable 24-48 hrs while patient wears it"),
("Other diagnostics","EEG","Hospital","In-person","EEG machine","Machine","EEG technician","Quiet, dim EEG room","EEG system",P3,60,"N","Sleep-deprived EEG needs prep"),
("Other diagnostics","EMG / nerve conduction study","Hospital","In-person","EMG machine","Machine","Neurologist","Neurophysiology room","EMG / NCS system",P6,45,"N",""),
("Other diagnostics","Pulmonary function test","Hospital","In-person","PFT equipment","Machine","Respiratory technician","PFT lab","Spirometer, body box",P3,30,"N",""),
("Other diagnostics","Sleep study (polysomnography)","Hospital / Sleep centre","In-person","Sleep lab bed","Room","Overnight sleep technician","Sleep lab room","PSG system",P4,600,"N","Overnight booking"),
("Other diagnostics","Audiometry","Hospital / ENT clinic","In-person","Soundproof booth","Room","Audiologist","Soundproof booth","Audiometer",P2,30,"N",""),
("Other diagnostics","Upper GI endoscopy","Hospital","In-person","Endoscopy suite","Room","Gastroenterologist, endoscopy nurse, sedation provider","Endoscopy suite + recovery bay","Endoscopy tower, gastroscope",P6,30,"N","Scope reprocessing time between cases; fasting"),
("Other diagnostics","Colonoscopy","Hospital","In-person","Endoscopy suite","Room","Gastroenterologist, endoscopy nurse, sedation provider","Endoscopy suite + recovery bay","Endoscopy tower, colonoscope",P6,45,"N","Bowel prep instructions"),
("Other diagnostics","Bronchoscopy","Hospital","In-person","Bronchoscopy suite","Room","Pulmonologist, nurse, anesthetist","Bronchoscopy suite + recovery","Bronchoscope, monitor",P6,45,"N",""),
("Other diagnostics","Cardiac catheterization / angiography","Hospital","In-person","Cath lab","Machine","Cardiologist, cath nurse, cardiac technician, radiographer","Cath lab + recovery bed","Cath lab system",P6,60,"N","Post-procedure bed needed"),
("Other diagnostics","Allergy skin prick test","Hospital / Clinic","In-person","Allergist","Person","Nurse","Procedure room","Allergen kit, emergency kit",P5,45,"N","Includes observation time"),
("Other diagnostics","Urodynamic study","Hospital","In-person","Urodynamic system","Machine","Urologist, nurse","Urodynamics room","Urodynamic system",P6,45,"N",""),
# Surgical
("Surgical","Pre-anesthesia check (PAC)","Hospital","In-person","Anesthetist","Person","Nurse","Consultation room","",P1,20,"N","Required before surgery"),
("Surgical","Pre-operative work-up bundle","Hospital","In-person","Pre-op nurse coordinator","Person","Phlebotomist, ECG tech, radiographer","Multiple departments","Lab, ECG, X-ray",P7,90,"N","Sequenced across lab, ECG, X-ray, PAC"),
("Surgical","Major elective surgery","Hospital","In-person","Operating theatre (OT)","Room","Primary surgeon, assistant surgeon(s), anesthetist, scrub nurse, circulating nurse, OT technician","OT + pre-op holding + recovery (PACU) + ward / ICU bed","Anesthesia machine, instrument sets, C-arm / microscope as needed",P6,180,"N","Book blood units, implants, post-op bed"),
("Surgical","Day-care surgery (e.g., cataract, hernia)","Hospital / Day surgery centre","In-person","Operating theatre","Room","Surgeon, anesthetist, scrub nurse","OT + day-care bed","Procedure-specific (e.g., phaco machine, microscope)",P6,60,"N","Same-day discharge"),
("Surgical","Minor surgery (local anesthesia)","Hospital / Clinic","In-person","Minor OT","Room","Surgeon, nurse","Minor OT","Minor instrument set",P5,30,"N",""),
("Surgical","Laparoscopic surgery","Hospital","In-person","Operating theatre","Room","Surgeon, assistant, anesthetist, scrub and circulating nurses","OT + PACU + ward bed","Laparoscopy tower, anesthesia machine",P6,120,"N",""),
("Surgical","Robotic surgery","Hospital","In-person","Robotic OT","Machine","Console surgeon, bedside assistant, anesthetist, robotics-trained nurses","Robotic OT + PACU + ward bed","Surgical robot, anesthesia machine",P6,240,"N","Robot availability is the bottleneck"),
("Surgical","Organ transplant surgery","Hospital","In-person","Two operating theatres","Room","Donor and recipient surgical teams, anesthesia teams, perfusionist, transplant coordinator","2 OTs + ICU bed","Anesthesia machines, perfusion equipment",P6,360,"N","Simultaneous coordinated booking"),
("Surgical","Emergency surgery slot","Hospital","In-person","Emergency OT","Room","On-call surgeon, anesthetist, OT nurses","Emergency OT + ICU / ward bed","Anesthesia machine",P6,"Varies","N","Unscheduled; may displace elective cases"),
("Surgical","Post-op review","Hospital OPD","In-person","Surgeon","Person","Nurse","Consultation room","",P1,15,"N",""),
("Surgical","Wound dressing","Hospital / Clinic","In-person","Dressing room","Room","Nurse","Dressing room","Dressing trolley",P4,15,"Y",""),
("Surgical","Suture / staple removal","Hospital / Clinic","In-person","Nurse","Person","","Dressing room","Suture removal kit",P1,10,"N",""),
# Inpatient
("Inpatient","Elective admission","Hospital","In-person","Ward bed","Bed","Admitting doctor, ward nurse, admissions desk","Ward room (general / private / suite)","Bed, monitor",P4,"Varies","N","Duration = expected length of stay"),
("Inpatient","Day-care admission","Hospital","In-person","Day-care bed","Bed","Day-care nurse","Day-care ward","Bed",P4,480,"N",""),
("Inpatient","Planned ICU bed (post major surgery)","Hospital","In-person","ICU bed","Bed","Intensivist, ICU nurse","ICU","Ventilator, multipara monitor",P4,"Varies","N","Linked to surgery booking"),
("Inpatient","Isolation room booking","Hospital","In-person","Isolation room","Room","Ward nurse","Negative-pressure room","",P4,"Varies","N",""),
("Inpatient","Labour and delivery booking","Hospital","In-person","Labour room","Room","Obstetrician, midwife, pediatrician, anesthetist (epidural)","Labour room","Labour bed, CTG monitor, baby warmer",P6,"Varies","N",""),
("Inpatient","Elective caesarean section","Hospital","In-person","Operating theatre","Room","Obstetrician, assistant, anesthetist, neonatologist, scrub nurse","OT + recovery + postnatal bed","Anesthesia machine, baby warmer",P6,90,"N",""),
("Inpatient","Discharge planning meeting","Hospital","In-person","Case manager","Person","Doctor, nurse, social worker","Meeting room / bedside","",P5,30,"N",""),
# Dental
("Dental","Dental check-up","Dental clinic","In-person","Dental chair","Chair","Dentist, dental assistant","Dental operatory","Dental unit, intraoral camera",P4,20,"N",""),
("Dental","Scaling and polishing","Dental clinic","In-person","Dental chair","Chair","Dental hygienist","Dental operatory","Ultrasonic scaler",P4,30,"Y",""),
("Dental","Filling","Dental clinic","In-person","Dental chair","Chair","Dentist, dental assistant","Dental operatory","Curing light, handpieces",P4,45,"N",""),
("Dental","Root canal treatment","Dental clinic","In-person","Dental chair","Chair","Endodontist, dental assistant","Dental operatory","Rotary endo motor, apex locator, RVG",P4,60,"Y","Usually multiple visits"),
("Dental","Tooth extraction","Dental clinic","In-person","Dental chair","Chair","Dentist, dental assistant","Dental operatory","Extraction kit",P4,30,"N",""),
("Dental","Surgical / wisdom tooth extraction","Dental clinic / Hospital","In-person","Dental chair or OT","Chair","Oral surgeon, assistant, anesthetist (if GA)","Surgical operatory / OT","Surgical motor, suction",P5,60,"N",""),
("Dental","Dental X-ray (IOPA / OPG / CBCT)","Dental clinic","In-person","OPG / CBCT machine","Machine","Dental radiographer / assistant","Dental X-ray room","OPG or CBCT unit",P3,15,"N",""),
("Dental","Orthodontic adjustment","Dental clinic","In-person","Dental chair","Chair","Orthodontist","Dental operatory","Ortho kit",P4,20,"Y","Monthly recurring"),
("Dental","Crown / bridge / denture","Dental clinic","In-person","Dental chair","Chair","Prosthodontist, dental lab technician","Dental operatory + dental lab","Impression materials, lab equipment",P5,45,"Y","Multiple visits; lab turnaround between"),
("Dental","Dental implant surgery","Dental clinic","In-person","Surgical dental chair","Chair","Implantologist, dental assistant","Surgical operatory","Implant motor, CBCT",P6,90,"N",""),
("Dental","Pediatric dental visit","Dental clinic","In-person","Dental chair","Chair","Pedodontist, assistant","Pediatric operatory","Dental unit",P4,30,"N",""),
("Dental","Dental treatment under general anesthesia","Hospital","In-person","Operating theatre","Room","Dentist, anesthetist, nurse","OT + recovery","Anesthesia machine, portable dental unit",P6,90,"N",""),
# Rehab
("Rehabilitation","Physiotherapy session","Hospital / Clinic / Home","In-person","Physiotherapist","Person","","Physio cubicle / gym","Plinth, IFT, TENS, therapeutic ultrasound",P2,45,"Y","Often a course of 6-12 sessions"),
("Rehabilitation","Hydrotherapy","Hospital / Rehab centre","In-person","Hydrotherapy pool","Room","Physiotherapist, pool assistant","Hydrotherapy pool","Pool hoist",P4,45,"Y","Pool capacity limits group size"),
("Rehabilitation","Occupational therapy","Hospital / Rehab centre","In-person","Occupational therapist","Person","","OT room","ADL training kit",P2,45,"Y",""),
("Rehabilitation","Speech and language therapy","Hospital / Clinic","In-person / Virtual","Speech therapist","Person","","Therapy room","",P1,45,"Y",""),
("Rehabilitation","Cardiac rehabilitation","Hospital","In-person","Rehab gym","Room","Physiotherapist, cardiac nurse","Rehab gym","Treadmill, cycle ergometer, telemetry",P6,60,"Y","Group sessions"),
("Rehabilitation","Pulmonary rehabilitation","Hospital","In-person","Rehab gym","Room","Physiotherapist, respiratory therapist","Rehab gym","Oxygen, pulse oximeters",P6,60,"Y","Group sessions"),
("Rehabilitation","Prosthetic / orthotic fitting","Hospital / Rehab centre","In-person","Prosthetist / orthotist","Person","Workshop technician","Fitting room + workshop","Fabrication equipment",P5,60,"Y","Multiple fittings"),
("Rehabilitation","Chiropractic session","Clinic","In-person","Chiropractor","Person","","Treatment room","Adjusting table",P2,30,"Y",""),
# Mental health
("Mental health","Psychiatry consultation","Hospital / Clinic","In-person / Virtual","Psychiatrist","Person","","Private consultation room","",P1,30,"N",""),
("Mental health","Psychotherapy / counseling","Hospital / Clinic","In-person / Virtual","Psychologist / counselor","Person","","Private therapy room","",P1,50,"Y",""),
("Mental health","Psychological assessment","Hospital / Clinic","In-person","Clinical psychologist","Person","","Testing room","Psychometric test kits",P2,120,"N","Sometimes split over 2 sessions"),
("Mental health","Group therapy","Hospital / Clinic","In-person","Group room","Room","Therapist, co-facilitator","Group room","",P5,90,"Y",""),
("Mental health","Family / couples therapy","Clinic","In-person / Virtual","Family therapist","Person","","Large therapy room","",P1,60,"Y",""),
("Mental health","Opioid substitution dosing","Hospital / De-addiction centre","In-person","Dispensing counter","Room","Nurse / pharmacist, doctor (review)","Dispensing area","Controlled-drug safe",P4,10,"Y","Daily recurring"),
("Mental health","Electroconvulsive therapy (ECT)","Hospital","In-person","ECT suite","Machine","Psychiatrist, anesthetist, nurse","ECT suite + recovery","ECT machine, anesthesia setup",P6,30,"Y","Course of sessions; fasting"),
# Maternal & child
("Maternal and child health","Antenatal visit","Hospital / Clinic","In-person","Obstetrician / midwife","Person","Nurse","Antenatal clinic room","Fetal Doppler, BP monitor",P2,20,"Y",""),
("Maternal and child health","Pregnancy scan (NT / anomaly / growth)","Hospital / Diagnostic centre","In-person","Ultrasound machine","Machine","Fetal medicine specialist / radiologist","Ultrasound room","High-end obstetric ultrasound",P3,30,"N","Gestational-age window is fixed"),
("Maternal and child health","Postnatal check","Hospital / Clinic","In-person","Obstetrician / midwife","Person","","Consultation room","",P1,20,"N",""),
("Maternal and child health","Lactation consultation","Hospital / Home","In-person","Lactation consultant","Person","","Private room","Breast pump (demo)",P1,45,"N",""),
("Maternal and child health","Well-baby visit","Hospital / Clinic","In-person","Pediatrician","Person","Nurse","Pediatric room","Infant scale, growth charts",P1,20,"Y",""),
("Maternal and child health","Childhood immunization","Hospital / Clinic","In-person","Nurse","Person","","Vaccination room","Vaccine refrigerator (cold chain)",P2,15,"Y","Schedule-driven"),
("Maternal and child health","Fertility consultation","Fertility centre","In-person","Fertility specialist","Person","Counselor","Consultation room","",P1,30,"N",""),
("Maternal and child health","IUI (intrauterine insemination)","Fertility centre","In-person","Procedure room","Room","Fertility specialist, andrology technician","Procedure room + andrology lab","Sperm prep equipment",P5,30,"N","Timed to ovulation"),
("Maternal and child health","IVF egg retrieval (OPU)","Fertility centre","In-person","Procedure room / OT","Room","Fertility specialist, embryologist, anesthetist, nurse","Procedure room + embryology lab + recovery","Ultrasound with needle guide, IVF incubators",P6,30,"N","Timed exactly to trigger injection"),
("Maternal and child health","Embryo transfer","Fertility centre","In-person","Procedure room","Room","Fertility specialist, embryologist","Procedure room + embryology lab","Ultrasound",P6,30,"N",""),
# Recurring treatments
("Recurring treatment","Hemodialysis","Hospital / Dialysis centre","In-person","Dialysis machine + chair","Machine","Dialysis nurse / technician, nephrologist (rounds)","Dialysis unit","Dialysis machine, RO water plant",P3,240,"Y","Usually 3x/week; separate machines for HBV/HCV-positive patients"),
("Recurring treatment","Peritoneal dialysis training","Hospital","In-person","PD nurse","Person","","Training room","PD cycler (demo)",P2,120,"Y",""),
("Recurring treatment","Chemotherapy infusion","Hospital day-care","In-person","Day-care chair / bed","Chair","Oncology nurse, oncologist (review), oncology pharmacist (drug prep)","Chemo day-care","Infusion pump, biosafety cabinet in pharmacy",P6,240,"Y","Drug prep starts after blood counts cleared"),
("Recurring treatment","Radiotherapy simulation / planning","Hospital","In-person","CT simulator","Machine","Radiation therapist, medical physicist, radiation oncologist","CT simulator room","CT simulator, immobilization devices",P6,45,"N",""),
("Recurring treatment","Radiotherapy session","Hospital","In-person","Linear accelerator (LINAC)","Machine","2 radiation therapists","LINAC bunker","LINAC",P3,15,"Y","Daily for several weeks"),
("Recurring treatment","Brachytherapy","Hospital","In-person","Brachytherapy suite","Machine","Radiation oncologist, physicist, anesthetist","Brachytherapy suite","HDR afterloader",P6,90,"Y",""),
("Recurring treatment","Infusion therapy (biologics, IV iron)","Hospital day-care","In-person","Infusion chair","Chair","Nurse","Infusion centre","Infusion pump",P4,120,"Y",""),
("Recurring treatment","Day-care blood transfusion","Hospital day-care","In-person","Day-care bed","Bed","Nurse, blood bank technician","Day-care ward","Cross-matched blood, infusion set",P4,240,"Y","Cross-match the day before"),
("Recurring treatment","Injection visit (B12, depot, hormone)","Clinic","In-person","Nurse","Person","","Injection room","",P1,10,"Y",""),
("Recurring treatment","Hyperbaric oxygen therapy","Hospital","In-person","Hyperbaric chamber","Machine","Chamber technician, physician","Hyperbaric unit","Hyperbaric chamber",P3,120,"Y","Multiplace chamber: group booking"),
("Recurring treatment","Wound care clinic","Hospital","In-person","Wound care nurse","Person","","Wound clinic room","Negative-pressure (VAC) device",P2,30,"Y",""),
("Recurring treatment","Phototherapy (dermatology)","Hospital / Clinic","In-person","Phototherapy cabin","Machine","Nurse / technician","Phototherapy room","NB-UVB cabin",P3,15,"Y","2-3x/week"),
# Preventive
("Preventive and occupational","Adult / travel vaccination","Hospital / Clinic / Pharmacy","In-person","Nurse","Person","","Vaccination room","Vaccine refrigerator",P2,15,"N",""),
("Preventive and occupational","Health check-up package","Hospital","In-person","Package coordinator","Person","Phlebotomist, radiographer, ECG tech, physician, dietitian","Multiple departments","Lab, X-ray, ECG, ultrasound, TMT",P7,240,"N","Itinerary sequenced across departments; fasting"),
("Preventive and occupational","Executive health check","Hospital","In-person","Package coordinator","Person","Multiple specialists and technicians","Dedicated executive lounge + departments","Lab, imaging, cardiac tests",P7,360,"N",""),
("Preventive and occupational","Pap smear / cervical screening","Hospital / Clinic","In-person","Gynecologist / nurse","Person","Female chaperone","Exam room","Speculum, sampling kit",P5,15,"N",""),
("Preventive and occupational","Pre-employment medical","Hospital / Clinic","In-person","Physician","Person","Phlebotomist, radiographer","Multiple departments","Lab, X-ray, vision chart",P7,60,"N",""),
("Preventive and occupational","Visa / immigration medical","Approved panel clinic","In-person","Panel physician","Person","Phlebotomist, radiographer","Multiple departments","Lab, chest X-ray",P7,90,"N","Only approved panel physicians"),
("Preventive and occupational","Fitness / driving certificate","Clinic","In-person","Physician","Person","","Consultation room","Vision chart",P1,15,"N",""),
("Preventive and occupational","Travel medicine consultation","Clinic","In-person / Virtual","Travel medicine physician","Person","","Consultation room","",P1,30,"N",""),
("Preventive and occupational","Occupational health surveillance","Hospital / Workplace","In-person","Occupational physician","Person","Audiologist, PFT technician","Multiple stations","Audiometer, spirometer, vision tester",P7,60,"Y","Annual"),
# Pharmacy
("Pharmacy","Prescription pickup","Pharmacy","In-person","Dispensing counter","Room","Pharmacist","Dispensing counter","",P4,5,"N",""),
("Pharmacy","Refill pickup","Pharmacy","In-person","Dispensing counter","Room","Pharmacist / pharmacy technician","Dispensing counter","",P4,5,"Y",""),
("Pharmacy","Medication therapy review","Pharmacy / Hospital","In-person / Virtual","Clinical pharmacist","Person","","Counseling room","",P1,30,"Y",""),
("Pharmacy","New medication counseling","Pharmacy","In-person","Pharmacist","Person","","Counseling room","",P1,15,"N",""),
("Pharmacy","Pharmacy vaccination","Pharmacy","In-person","Certified pharmacist","Person","","Consultation booth","Vaccine refrigerator",P2,15,"N",""),
("Pharmacy","Anticoagulation (INR) clinic","Pharmacy / Hospital","In-person","Pharmacist / nurse","Person","","Consultation booth","Point-of-care INR meter",P2,15,"Y",""),
("Pharmacy","Device training (inhaler, insulin pen, glucometer)","Pharmacy","In-person","Pharmacist","Person","","Counseling room","Demo devices",P2,20,"N",""),
("Pharmacy","Specialty drug dispensing","Specialty pharmacy","In-person","Specialty pharmacist","Person","","Counseling room","Cold-chain storage",P2,20,"Y",""),
("Pharmacy","Compounding / IV admixture","Hospital pharmacy","Internal","Clean room","Room","Pharmacist, pharmacy technician","Clean room","Biosafety cabinet / laminar flow hood",P6,60,"N","Internal booking linked to chemo/infusion slots"),
("Pharmacy","Home delivery slot","Pharmacy","Home","Delivery vehicle","Vehicle","Delivery staff","","Cold box (if needed)",P4,30,"Y",""),
# Home care
("Home care","Doctor home visit","Home","Home","Physician","Person","Driver","Patient home","Doctor's bag, portable ECG",P2,45,"N","Add travel time between visits"),
("Home care","Home nursing visit","Home","Home","Home care nurse","Person","","Patient home","Nursing kit",P2,60,"Y",""),
("Home care","Home physiotherapy","Home","Home","Physiotherapist","Person","","Patient home","Portable TENS, exercise bands",P2,45,"Y",""),
("Home care","Home sample collection","Home","Home","Phlebotomist","Person","","Patient home","Collection kit, cold box",P2,20,"N","Route planning for multiple visits"),
("Home care","Home wound care","Home","Home","Wound care nurse","Person","","Patient home","Dressing kit, VAC device",P2,30,"Y",""),
("Home care","Home IV / infusion therapy","Home","Home","Home infusion nurse","Person","Pharmacist (prep)","Patient home","Infusion pump",P6,60,"Y",""),
("Home care","Palliative care home visit","Home","Home","Palliative care team","Person","Palliative physician, nurse, social worker","Patient home","Syringe driver",P5,60,"Y",""),
("Home care","Elderly care / caregiver visit","Home","Home","Caregiver","Person","","Patient home","",P1,240,"Y","Shift-based"),
("Home care","Postnatal home visit","Home","Home","Midwife","Person","","Patient home","Infant scale",P2,45,"N",""),
("Home care","Portable X-ray / ECG at home","Home","Home","Portable X-ray / ECG unit","Machine","Radiographer, assistant, driver","Patient home","Portable X-ray, portable ECG",P6,45,"N",""),
("Home care","Medical equipment delivery and setup","Home","Home","Delivery vehicle","Vehicle","Biomedical technician","Patient home","Oxygen concentrator, hospital bed, BiPAP",P6,60,"N",""),
# Allied
("Allied health","Dietitian consultation","Hospital / Clinic","In-person / Virtual","Dietitian","Person","","Consultation room","Body composition analyzer",P2,30,"Y",""),
("Allied health","Diabetes education","Hospital / Clinic","In-person","Diabetes educator","Person","","Education room","Glucometer, insulin pen demo",P2,45,"N",""),
("Allied health","Podiatry / diabetic foot care","Hospital / Clinic","In-person","Podiatrist","Person","","Podiatry room","Podiatry chair, monofilament",P2,30,"Y",""),
("Allied health","Optometry / eye test","Optical / Eye clinic","In-person","Optometrist","Person","","Refraction room","Autorefractor, trial lens set",P2,20,"N",""),
("Allied health","Hearing aid fitting","ENT / Audiology clinic","In-person","Audiologist","Person","","Audiology room","Programming software, hearing aids",P2,60,"Y","Follow-up tuning visits"),
("Allied health","Smoking cessation","Clinic","In-person / Virtual","Counselor","Person","","Counseling room","CO monitor",P2,30,"Y",""),
("Allied health","Weight management","Clinic","In-person / Virtual","Physician / dietitian","Person","Fitness trainer","Consultation room","Body composition analyzer",P2,30,"Y",""),
# Complementary
("Complementary medicine","Ayurveda consultation","Ayurveda clinic","In-person","Ayurveda physician","Person","","Consultation room","",P1,30,"N",""),
("Complementary medicine","Panchakarma therapy","Ayurveda centre","In-person","Therapy room","Room","2 therapists (same gender), physician","Panchakarma room","Droni table, steam chamber",P5,90,"Y","Multi-day course"),
("Complementary medicine","Acupuncture","Clinic","In-person","Acupuncturist","Person","","Treatment room","Needles, treatment couch",P2,45,"Y",""),
("Complementary medicine","Homeopathy consultation","Clinic","In-person / Virtual","Homeopath","Person","","Consultation room","",P1,30,"N",""),
# Virtual
("Virtual care","Video consultation","Virtual","Virtual","Physician","Person","","Telehealth platform","Webcam, platform licence",P1,15,"N",""),
("Virtual care","Phone consultation","Virtual","Virtual","Physician","Person","","Phone line","",P1,10,"N",""),
("Virtual care","Chat / asynchronous consultation","Virtual","Virtual","Physician","Person","","Messaging platform","",P1,10,"N","Response window rather than fixed slot"),
("Virtual care","Remote monitoring review","Virtual","Virtual","Nurse / physician","Person","","Monitoring dashboard","Connected devices (BP, glucose, SpO2)",P2,15,"Y",""),
("Virtual care","E-prescription renewal","Virtual","Virtual","Physician","Person","","","",P1,5,"Y",""),
# Emergency
("Emergency and urgent care","Urgent care slot","Urgent care centre","In-person","Urgent care physician","Person","Nurse","Treatment cubicle","",P1,20,"N",""),
("Emergency and urgent care","Emergency fast-track","Hospital ED","In-person","ED physician","Person","Triage nurse","ED cubicle","Monitor",P5,"Varies","N","Triage-driven, not pre-booked"),
("Emergency and urgent care","Triage call-back","Virtual","Virtual","Triage nurse","Person","","Phone line","",P1,10,"N",""),
# Blood bank
("Blood bank and transplant","Whole blood donation","Blood bank","In-person","Donor couch","Bed","Phlebotomist, medical officer (screening)","Donation room","Blood bag, blood mixer",P4,45,"N","Donor eligibility interval applies"),
("Blood bank and transplant","Apheresis (platelet / plasma)","Blood bank","In-person","Apheresis machine","Machine","Apheresis technician, medical officer","Apheresis room","Apheresis machine",P3,90,"N",""),
("Blood bank and transplant","Transplant evaluation","Hospital","In-person","Transplant coordinator","Person","Multiple specialists, social worker","Multiple departments","Lab, imaging",P7,"Varies","N","Spread over several days"),
("Blood bank and transplant","Stem cell collection","Hospital","In-person","Apheresis machine","Machine","Hematologist, apheresis nurse","Apheresis room","Apheresis machine",P6,240,"N",""),
# Admin
("Administrative and support","Patient registration","Hospital / Clinic","In-person / Virtual","Front desk","Room","Registration staff","Front desk","",P4,10,"N",""),
("Administrative and support","Insurance pre-authorization","Hospital","In-person / Virtual","Insurance desk","Person","Insurance coordinator","Insurance desk","",P1,20,"N","Linked to surgery / admission"),
("Administrative and support","Financial / billing counseling","Hospital","In-person","Billing counselor","Person","","Counseling desk","",P1,20,"N",""),
("Administrative and support","Medical records / report collection","Hospital","In-person","Records desk","Room","Records staff","Medical records desk","",P4,10,"N",""),
("Administrative and support","Medical certificate","Hospital / Clinic","In-person","Physician","Person","","Consultation room","",P1,10,"N",""),
("Administrative and support","Interpreter booking","Hospital","In-person / Virtual","Interpreter","Person","","Attached to another appointment","",P1,"Varies","N","Add-on resource to a clinical appointment"),
("Administrative and support","Multidisciplinary team (MDT) / tumor board","Hospital","Internal","Conference room","Room","Oncologist, surgeon, radiologist, pathologist, radiation oncologist","Conference room","Display screen, PACS access",P5,60,"Y","Weekly; patient not present"),
("Administrative and support","Patient transport / ambulance","Hospital / Home","In-person","Ambulance","Vehicle","Driver, paramedic / EMT","","Ambulance (BLS / ALS)",P6,"Varies","N","Linked to admission, dialysis, discharge"),
]

import random, re

random.seed(42)

def esc(v):
    if v is None: return "NULL"
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def ins(table, cols, vals):
    return f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(esc(v) for v in vals)});"

def hm(s):
    h, m = s.split(':'); return int(h) * 60 + int(m)

DEPTS = [
 ("OPD","Outpatient clinics","#2F6FD0"),("SPEC","Specialty clinics","#3B82C4"),("LAB","Laboratory","#C77A1F"),
 ("RAD","Radiology and imaging","#7A4FD0"),("DIAG","Diagnostics and procedures","#8E5BB8"),("SURG","Surgery and theatres","#C2364A"),
 ("IPD","Inpatient wards","#B4477F"),("DENT","Dental","#1C8C9C"),("REHAB","Rehabilitation","#2E9A63"),
 ("MH","Mental health","#5A6FB0"),("MCH","Women and child","#D0567A"),("ONCO","Day care and oncology","#A85A2A"),
 ("DIAL","Dialysis","#3E7F9E"),("PREV","Preventive health","#4C8C3A"),("PHARM","Pharmacy","#178F78"),
 ("HOME","Home care","#B07A12"),("ALLIED","Allied health","#5C8A8A"),("WELL","Wellness and traditional","#7C7A2A"),
 ("VIRT","Virtual care","#4466AA"),("EMER","Emergency and urgent care","#D23B2F"),("BLOOD","Blood bank","#A3203A"),
 ("ADMIN","Administration and support","#5F6B7A"),
]

# code: (label, kind, dept, count, schedule, capacity, turnover, title_dr)
ROLES = {
 # people
 'gp':("General physician","person","OPD",5,"opd_gp",1,0,True),
 'cardiologist':("Cardiologist","person","SPEC",2,"opd",1,0,True),
 'ophthalmologist':("Ophthalmologist","person","SPEC",1,"opd",1,0,True),
 'optometrist':("Optometrist","person","ALLIED",2,"day",1,0,False),
 'ent':("ENT surgeon","person","SPEC",1,"opd_mwf",1,0,True),
 'dermatologist':("Dermatologist","person","SPEC",1,"opd",1,0,True),
 'obgyn':("Obstetrician / gynecologist","person","MCH",2,"opd",1,0,True),
 'pediatrician':("Pediatrician","person","MCH",2,"opd",1,0,True),
 'oncologist':("Medical oncologist","person","ONCO",2,"opd",1,0,True),
 'ortho':("Orthopedic surgeon","person","SPEC",2,"opd",1,0,True),
 'plaster_tech':("Plaster technician","person","SPEC",1,"day",1,0,False),
 'nurse':("Staff nurse","person","OPD",10,"nurse",1,0,False),
 'phlebotomist':("Phlebotomist","person","LAB",5,"lab",1,0,False),
 'hematologist':("Hematologist","person","LAB",1,"opd",1,0,True),
 'pathologist':("Pathologist","person","LAB",1,"office",1,0,True),
 'lab_tech':("Lab technician","person","LAB",2,"day",1,0,False),
 'genetic_counselor':("Genetic counselor","person","LAB",1,"office",1,0,False),
 'radiographer':("Radiographer","person","RAD",8,"shift3",1,0,False),
 'radiologist':("Radiologist","person","RAD",4,"day",1,0,True),
 'fetal_medicine':("Fetal medicine specialist","person","MCH",1,"opd",1,0,True),
 'mri_tech':("MRI technologist","person","RAD",3,"mri_staff",1,0,False),
 'nuc_tech':("Nuclear medicine technologist","person","RAD",2,"office",1,0,False),
 'ecg_tech':("Cardiac technician","person","DIAG",4,"day",1,0,False),
 'neurologist':("Neurologist","person","DIAG",1,"opd",1,0,True),
 'eeg_tech':("EEG technologist","person","DIAG",1,"office",1,0,False),
 'resp_tech':("Respiratory therapist","person","DIAG",2,"day",1,0,False),
 'sleep_tech':("Sleep technologist","person","DIAG",2,"night",1,0,False),
 'audiologist':("Audiologist","person","ALLIED",2,"day",1,0,False),
 'gastro':("Gastroenterologist","person","DIAG",2,"day",1,0,True),
 'endo_nurse':("Endoscopy nurse","person","DIAG",3,"day",1,0,False),
 'pulmonologist':("Pulmonologist","person","DIAG",1,"opd",1,0,True),
 'cath_tech':("Cath lab technician","person","DIAG",1,"day",1,0,False),
 'allergist':("Allergist","person","DIAG",1,"opd_mwf",1,0,True),
 'urologist':("Urologist","person","SURG",1,"opd",1,0,True),
 'anesthetist':("Anesthetist","person","SURG",6,"ot_staff",1,0,True),
 'surgeon':("General surgeon","person","SURG",5,"surgeon",1,0,True),
 'asst_surgeon':("Assistant surgeon","person","SURG",3,"ot_day",1,0,True),
 'scrub_nurse':("Scrub nurse","person","SURG",5,"ot_staff",1,0,False),
 'ot_tech':("OT technician","person","SURG",3,"ot_day",1,0,False),
 'perfusionist':("Perfusionist","person","SURG",1,"ot_day",1,0,False),
 'transplant_coord':("Transplant coordinator","person","SURG",1,"office",1,0,False),
 'intensivist':("Intensivist","person","IPD",2,"h24",1,0,True),
 'midwife':("Midwife","person","MCH",4,"nurse",1,0,False),
 'neonatologist':("Neonatologist","person","MCH",2,"h24",1,0,True),
 'case_manager':("Case manager","person","IPD",1,"office",1,0,False),
 'social_worker':("Medical social worker","person","IPD",2,"office",1,0,False),
 'dentist':("Dentist","person","DENT",3,"dental",1,0,True),
 'dental_assistant':("Dental assistant","person","DENT",4,"dental",1,0,False),
 'hygienist':("Dental hygienist","person","DENT",1,"dental",1,0,False),
 'endodontist':("Endodontist","person","DENT",1,"dental_mwf",1,0,True),
 'oral_surgeon':("Oral and maxillofacial surgeon","person","DENT",1,"dental_tts",1,0,True),
 'orthodontist':("Orthodontist","person","DENT",1,"dental",1,0,True),
 'prosthodontist':("Prosthodontist","person","DENT",1,"dental",1,0,True),
 'pedodontist':("Pediatric dentist","person","DENT",1,"dental",1,0,True),
 'implantologist':("Implantologist","person","DENT",1,"dental_mwf",1,0,True),
 'physio':("Physiotherapist","person","REHAB",5,"rehab",1,0,False),
 'occ_therapist':("Occupational therapist","person","REHAB",1,"office",1,0,False),
 'speech_therapist':("Speech and language therapist","person","REHAB",1,"office",1,0,False),
 'cardiac_nurse':("Cardiac rehab nurse","person","REHAB",1,"office",1,0,False),
 'prosthetist':("Prosthetist / orthotist","person","REHAB",1,"office",1,0,False),
 'chiropractor':("Chiropractor","person","REHAB",1,"opd_mwf",1,0,False),
 'psychiatrist':("Psychiatrist","person","MH",2,"opd",1,0,True),
 'psychologist':("Clinical psychologist","person","MH",2,"office",1,0,False),
 'counselor':("Counselor","person","MH",2,"office",1,0,False),
 'family_therapist':("Family therapist","person","MH",1,"office",1,0,False),
 'lactation':("Lactation consultant","person","MCH",1,"office",1,0,False),
 'fertility_specialist':("Fertility specialist","person","MCH",1,"fertility",1,0,True),
 'embryologist':("Embryologist","person","MCH",1,"fertility",1,0,False),
 'andrology_tech':("Andrology technician","person","MCH",1,"fertility",1,0,False),
 'dialysis_nurse':("Dialysis nurse","person","DIAL",4,"dialysis_staff",3,0,False),
 'nephrologist':("Nephrologist","person","DIAL",1,"opd",1,0,True),
 'oncology_nurse':("Oncology nurse","person","ONCO",3,"day",2,0,False),
 'oncology_pharmacist':("Oncology pharmacist","person","ONCO",1,"pharm_early",1,0,False),
 'rad_therapist':("Radiation therapist","person","ONCO",4,"linac_staff",1,0,False),
 'physicist':("Medical physicist","person","ONCO",1,"office",1,0,False),
 'rad_oncologist':("Radiation oncologist","person","ONCO",1,"opd",1,0,True),
 'hbot_tech':("Hyperbaric technician","person","ONCO",1,"office",1,0,False),
 'wound_nurse':("Wound care nurse","person","SURG",1,"day",1,0,False),
 'package_coord':("Health check coordinator","person","PREV",2,"prev",3,0,False),
 'panel_physician':("Panel physician","person","PREV",1,"office",1,0,True),
 'occ_physician':("Occupational physician","person","PREV",1,"office",1,0,True),
 'pharmacist':("Pharmacist","person","PHARM",4,"pharm",1,0,False),
 'clinical_pharmacist':("Clinical pharmacist","person","PHARM",1,"office",1,0,False),
 'pharm_tech':("Pharmacy technician","person","PHARM",2,"pharm",1,0,False),
 'delivery_staff':("Delivery associate","person","PHARM",2,"home",1,0,False),
 'home_physician':("Home care physician","person","HOME",1,"home",1,0,True),
 'home_nurse':("Home care nurse","person","HOME",4,"home",1,0,False),
 'home_physio':("Home physiotherapist","person","HOME",2,"home",1,0,False),
 'caregiver':("Caregiver","person","HOME",3,"home",1,0,False),
 'palliative_physician':("Palliative care physician","person","HOME",1,"office",1,0,True),
 'dietitian':("Dietitian","person","ALLIED",2,"office",1,0,False),
 'diabetes_educator':("Diabetes educator","person","ALLIED",1,"office",1,0,False),
 'podiatrist':("Podiatrist","person","ALLIED",1,"opd_mwf",1,0,False),
 'ayurveda':("Ayurveda physician","person","WELL",1,"opd",1,0,True),
 'panchakarma_therapist':("Panchakarma therapist","person","WELL",3,"wellness",1,0,False),
 'acupuncturist':("Acupuncturist","person","WELL",1,"opd_mwf",1,0,False),
 'homeopath':("Homeopath","person","WELL",1,"opd",1,0,True),
 'urgent_physician':("Urgent care physician","person","EMER",2,"urgent",1,0,True),
 'ed_physician':("Emergency physician","person","EMER",3,"shift3",1,0,True),
 'triage_nurse':("Triage nurse","person","EMER",3,"shift3",1,0,False),
 'donor_mo':("Blood bank medical officer","person","BLOOD",1,"blood",1,0,True),
 'apheresis_tech':("Apheresis technician","person","BLOOD",1,"blood",1,0,False),
 'registration_staff':("Registration executive","person","ADMIN",3,"day7",1,0,False),
 'insurance_coord':("Insurance coordinator","person","ADMIN",1,"office",1,0,False),
 'billing_counselor':("Billing counselor","person","ADMIN",1,"office",1,0,False),
 'records_staff':("Medical records officer","person","ADMIN",1,"office",1,0,False),
 'interpreter':("Interpreter","person","ADMIN",2,"office",1,0,False),
 'driver':("Driver","person","HOME",3,"shift3",1,0,False),
 'paramedic':("Paramedic","person","EMER",3,"shift3",1,0,False),
 'biomed_tech':("Biomedical technician","person","ADMIN",1,"office",1,0,False),
 # spaces and machines
 'consult_room':("Consultation room","room","OPD",12,"day7",1,0,False),
 'procedure_room':("Procedure room","room","OPD",3,"day",1,10,False),
 'group_room':("Group room","room","OPD",1,"day",1,10,False),
 'eye_suite':("Eye examination suite","room","SPEC",1,"day",1,0,False),
 'plaster_room':("Plaster room","room","SPEC",1,"day",1,5,False),
 'collection_chair':("Collection chair","chair","LAB",4,"lab_room",1,0,False),
 'sample_washroom':("Sample washroom","room","LAB",2,"lab_room",1,5,False),
 'prep_bay':("Contrast prep bay","bed","RAD",2,"h24",1,5,False),
 'recovery_bay':("Day recovery bay","bed","DIAG",5,"recovery",1,10,False),
 'uptake_room':("PET uptake room","room","RAD",2,"office",1,10,False),
 'xray_unit':("X-ray unit","machine","RAD",2,"h24",1,0,False),
 'us_unit':("Ultrasound unit","machine","RAD",3,"day",1,5,False),
 'ct_scanner':("CT scanner","machine","RAD",2,"h24",1,5,False),
 'mri_scanner':("MRI scanner","machine","RAD",2,"mri",1,10,False),
 'mammo_unit':("Mammography unit","machine","RAD",1,"day",1,5,False),
 'dexa':("DEXA scanner","machine","RAD",1,"day",1,0,False),
 'pet_ct':("PET-CT scanner","machine","RAD",1,"office",1,10,False),
 'gamma_camera':("Gamma camera","machine","RAD",1,"day",1,5,False),
 'fluoro_unit':("Fluoroscopy unit","machine","RAD",1,"day",1,10,False),
 'ir_suite':("Interventional radiology suite","room","RAD",1,"ot_day",1,30,False),
 'ecg_machine':("ECG machine","machine","DIAG",3,"h24",1,0,False),
 'echo_machine':("Echocardiography unit","machine","DIAG",2,"day",1,5,False),
 'tmt_machine':("Treadmill stress system","machine","DIAG",1,"day",1,10,False),
 'holter':("Holter recorder","machine","DIAG",6,"h24",1,30,False),
 'eeg_machine':("EEG system","machine","DIAG",1,"day",1,10,False),
 'emg_machine':("EMG / NCS system","machine","DIAG",1,"day",1,5,False),
 'pft_lab':("Pulmonary function lab","room","DIAG",1,"day",1,10,False),
 'sleep_bed':("Sleep lab bed","bed","DIAG",2,"night",1,60,False),
 'audio_booth':("Soundproof audiology booth","room","ALLIED",1,"day",1,5,False),
 'endo_suite':("Endoscopy suite","room","DIAG",2,"day",1,15,False),
 'bronch_suite':("Bronchoscopy suite","room","DIAG",1,"day",1,20,False),
 'cath_lab':("Cath lab","room","DIAG",1,"h24",1,30,False),
 'urodynamics':("Urodynamic system","machine","DIAG",1,"day",1,15,False),
 'ot':("Operating theatre","room","SURG",5,"ot_day",1,30,False),
 'minor_ot':("Minor OT","room","SURG",1,"day",1,15,False),
 'robot':("Surgical robot","machine","SURG",1,"ot_day",1,45,False),
 'lap_tower':("Laparoscopy tower","machine","SURG",2,"ot_day",1,15,False),
 'pacu_bed':("Recovery (PACU) bed","bed","SURG",6,"h24",1,15,False),
 'ward_bed':("Ward bed","bed","IPD",16,"h24",1,60,False),
 'daycare_bed':("Day-care bed","bed","IPD",8,"daycare",1,30,False),
 'icu_bed':("ICU bed","bed","IPD",4,"h24",1,120,False),
 'isolation_room':("Isolation room","room","IPD",2,"h24",1,120,False),
 'labour_room':("Labour room","room","MCH",3,"h24",1,60,False),
 'dressing_room':("Dressing room","room","SURG",2,"day",1,10,False),
 'dental_chair':("Dental chair","chair","DENT",5,"dental",1,10,False),
 'opg':("OPG / CBCT unit","machine","DENT",1,"dental",1,0,False),
 'physio_cubicle':("Physio cubicle","room","REHAB",6,"day",1,5,False),
 'hydro_pool':("Hydrotherapy pool","room","REHAB",1,"office",4,15,False),
 'rehab_gym':("Rehab gym","room","REHAB",1,"day",8,0,False),
 'therapy_room':("Therapy room","room","MH",6,"day",1,0,False),
 'ect_suite':("ECT suite","room","MH",1,"ect",1,15,False),
 'dialysis_station':("Dialysis station","machine","DIAL",8,"dialysis",1,30,False),
 'chemo_chair':("Chemo day-care chair","chair","ONCO",8,"day",1,15,False),
 'clean_room':("Pharmacy clean room","room","PHARM",1,"clean",2,10,False),
 'ct_sim':("CT simulator","machine","ONCO",1,"day",1,10,False),
 'linac':("Linear accelerator","machine","ONCO",2,"linac",1,5,False),
 'afterloader':("HDR afterloader","machine","ONCO",1,"office",1,30,False),
 'infusion_chair':("Infusion chair","chair","ONCO",6,"day",1,10,False),
 'hbot':("Hyperbaric chamber","machine","ONCO",1,"office",6,30,False),
 'photo_cabin':("Phototherapy cabin","machine","SPEC",1,"day",1,5,False),
 'injection_room':("Injection and vaccination room","room","OPD",2,"day7",1,0,False),
 'ivf_lab':("IVF and embryology lab","room","MCH",1,"fertility",3,0,False),
 'pharmacy_counter':("Pharmacy counter","room","PHARM",3,"pharm_counter",1,0,False),
 'counsel_booth':("Pharmacy counseling booth","room","PHARM",2,"pharm_counter",1,0,False),
 'home_car':("Home visit car","vehicle","HOME",2,"home",1,0,False),
 'delivery_van':("Delivery van","vehicle","PHARM",2,"home",1,0,False),
 'ambulance':("Ambulance","vehicle","EMER",3,"h24",1,20,False),
 'portable_xray':("Portable X-ray unit","machine","HOME",1,"home",1,15,False),
 'donor_couch':("Donor couch","bed","BLOOD",4,"blood",1,10,False),
 'apheresis':("Apheresis machine","machine","BLOOD",2,"blood",1,20,False),
 'front_desk':("Registration counter","room","ADMIN",3,"day7",1,0,False),
 'records_desk':("Medical records desk","room","ADMIN",1,"office",1,0,False),
 'conference_room':("Conference room","room","ADMIN",1,"office",1,0,False),
 'panchakarma_room':("Panchakarma room","room","WELL",2,"wellness",1,20,False),
 'urgent_cubicle':("Urgent care cubicle","room","EMER",4,"h24",1,10,False),
}

MON_FRI=[1,2,3,4,5]; MON_SAT=[1,2,3,4,5,6]; ALL=[0,1,2,3,4,5,6]
# schedule -> list of variants; variant -> list of (days, start, end, tag, release_h, parity)
def W(days, s, e, tag='general', rel=0, parity=None): return (days, hm(s) if isinstance(s,str) else s, hm(e) if isinstance(e,str) else e, tag, rel, parity)
SCHED = {
 'opd':[[W(MON_FRI,'09:00','13:00'),W(MON_FRI,'14:00','17:00'),W([6],'09:00','13:00',parity=0)],
        [W(MON_FRI,'10:00','14:00'),W(MON_FRI,'15:00','19:00'),W([6],'09:00','13:00',parity=1)]],
 'opd_gp':[[W(MON_FRI,'09:00','12:00'),W(MON_FRI,'12:00','13:00','walkin',2),W(MON_FRI,'14:00','17:00'),W([6],'09:00','13:00',parity=0)],
           [W(MON_FRI,'10:00','14:00'),W(MON_FRI,'15:00','18:00'),W(MON_FRI,'18:00','19:00','urgent',3),W([6],'09:00','13:00',parity=1)],
           [W(MON_SAT,'08:00','12:00'),W(MON_SAT,'13:00','16:00')]],
 'opd_mwf':[[W([1,3,5],'09:00','13:00'),W([1,3,5],'14:00','17:00')]],
 'day':[[W(MON_SAT,'08:00','20:00')]],
 'day7':[[W(ALL,'07:00','21:00')]],
 'daycare':[[W(ALL,'07:00','21:00')]],
 'recovery':[[W(MON_SAT,'07:00','22:00')]],
 'office':[[W(MON_FRI,'08:30','17:00')]],
 'h24':[[W(ALL,0,1440)]],
 'mri':[[W(ALL,'07:00','23:00')]],
 'mri_staff':[[W(ALL,'07:00','15:00')],[W(ALL,'15:00','23:00')]],
 'night':[[W([0,1,2,3,4],'20:00',hm('08:00')+1440)]],
 'lab':[[W(MON_SAT,'06:30','14:30'),W([0],'07:00','11:00')],[W(MON_SAT,'12:00','20:00')]],
 'lab_room':[[W(MON_SAT,'06:30','20:00'),W([0],'07:00','11:00')]],
 'nurse':[[W(ALL,'07:00','15:00')],[W(ALL,'13:00','21:00')]],
 'shift3':[[W(ALL,'06:00','14:00')],[W(ALL,'14:00','22:00')],[W(ALL,'22:00',hm('06:00')+1440)]],
 'surgeon':[[W(MON_SAT,'08:00','18:00')]],
 'ot_day':[[W(MON_SAT,'08:00','20:00')]],
 'ot_staff':[[W(MON_SAT,'08:00','20:00')]],
 'dental':[[W(MON_SAT,'09:00','18:00')]],
 'dental_mwf':[[W([1,3,5],'09:00','18:00')]],
 'dental_tts':[[W([2,4,6],'09:00','18:00')]],
 'rehab':[[W(MON_SAT,'07:00','14:00')],[W(MON_SAT,'13:00','20:00')]],
 'fertility':[[W(MON_SAT,'07:00','15:00')]],
 'dialysis':[[W(MON_SAT,'06:00','22:00')]],
 'dialysis_staff':[[W(MON_SAT,'06:00','14:00')],[W(MON_SAT,'14:00','22:00')]],
 'linac':[[W(MON_FRI,'07:00','19:00')]],
 'linac_staff':[[W(MON_FRI,'07:00','13:00')],[W(MON_FRI,'13:00','19:00')]],
 'prev':[[W(MON_SAT,'07:00','15:00')]],
 'pharm':[[W(ALL,'08:00','15:00')],[W(ALL,'15:00','22:00')]],
 'pharm_counter':[[W(ALL,'07:00','23:00')]],
 'pharm_early':[[W(MON_SAT,'06:30','15:00')]],
 'clean':[[W(MON_SAT,'06:00','22:00')]],
 'home':[[W(MON_SAT,'08:00','18:00')]],
 'urgent':[[W(ALL,'08:00','15:00')],[W(ALL,'15:00','22:00')]],
 'ect':[[W([1,3,5],'07:00','12:00')]],
 'blood':[[W(MON_SAT,'08:00','17:00')]],
 'wellness':[[W(MON_SAT,'07:00','15:00')]],
}

FIRST = ["Ananya","Rahul","Meera","Arjun","Kavya","Rohan","Priya","Vikram","Sneha","Aditya","Fatima","Imran","Lakshmi","Suresh","Neha",
 "Karthik","Divya","Sanjay","Pooja","Anil","Ritu","Farhan","Deepa","Manoj","Shreya","Naveen","Asha","Harish","Nisha","Gaurav",
 "Leena","Omar","Sara","Daniel","Grace","Joseph","Maria","Thomas","Aisha","Yusuf","Elena","Chen","Hiro","Amara","Noah","Zara",
 "Ishaan","Tara","Kabir","Mira","Dev","Riya","Varun","Anjali","Siddharth","Bhavna","Rakesh","Uma","Nikhil","Pallavi"]
LAST = ["Rao","Sharma","Iyer","Menon","Nair","Kapoor","Reddy","Khan","Pillai","Das","Gupta","Joshi","Fernandes","Mehta","Bose",
 "Kulkarni","Chatterjee","Varghese","Siddiqui","Thomas","Banerjee","Patel","Singh","Krishnan","Ahmed","D'Souza","Mathew","Shetty","Hegde","Bhat"]
used=set()
def person_name(dr):
    while True:
        n=f"{random.choice(FIRST)} {random.choice(LAST)}"
        if n not in used: used.add(n); return ("Dr. "+n) if dr else n

MACHINE_LABELS = {
 'mri_scanner':["MRI 1 (3T)","MRI 2 (1.5T)"],'ct_scanner':["CT 1 (128-slice)","CT 2 (64-slice)"],
 'ot':["OT 1","OT 2","OT 3","OT 4","OT 5 (Emergency)"],'linac':["LINAC A","LINAC B"],
 'xray_unit':["X-ray Room 1","X-ray Room 2"],'us_unit':["USG 1","USG 2","USG 3 (Obstetric)"],
}

out=[]
out.append("-- CareGrid reference data (generated). Times are minutes from midnight; end can exceed 1440 for overnight windows.")
for i,(c,n,col) in enumerate(DEPTS,1):
    out.append(ins("departments",["id","code","name","color"],[i,c,n,col]))
dept_id={c:i for i,(c,_,_) in enumerate(DEPTS,1)}

for code,(label,kind,dept,count,sched,cap,turn,dr) in ROLES.items():
    out.append(ins("roles",["code","label","kind","department_id","turnover_min"],[code,label,kind,dept_id[dept],turn]))

rid=0; tid=0
resources_by_role={}
for code,(label,kind,dept,count,sched,cap,turn,dr) in ROLES.items():
    for i in range(count):
        rid+=1
        if kind=='person':
            name=person_name(dr)
        elif code in MACHINE_LABELS:
            name=MACHINE_LABELS[code][i]
        else:
            name=f"{label} {i+1}" if count>1 else label
        variants=SCHED[sched]
        var=variants[i % len(variants)]
        if code in ('anesthetist','scrub_nurse','surgeon') and i==count-1:
            var=[W(ALL,0,1440)]  # on-call cover
        if code=='ot' and i==count-1:
            var=[W(ALL,0,1440,'urgent',4)]
        always_on = 1 if any(w[1]==0 and w[2]>=1440 for w in var) else 0
        out.append(ins("resources",["id","role_code","name","kind","department_id","capacity","always_on","active"],
                       [rid,code,name,kind,dept_id[dept],cap,always_on,1]))
        resources_by_role.setdefault(code,[]).append(rid)
        for (days,s,e,tag,rel,parity) in var:
            for d in days:
                tid+=1
                out.append(ins("resource_templates",["id","resource_id","weekday","start_min","end_min","tag","release_hours","week_parity","effective_from","effective_to"],
                               [tid,rid,d,s,e,tag,rel,parity,None,None]))

# ---------------- appointment types ----------------
SPEC = {
"New patient consultation":"gp;consult_room","Follow-up visit":"gp;consult_room",
"Specialist referral consultation":"cardiologist|neurologist|gastro|pulmonologist;consult_room",
"Second opinion":"oncologist|cardiologist|ortho;consult_room","Walk-in visit":"gp;consult_room",
"Chronic disease review (diabetes, BP, asthma)":"gp;consult_room;nurse@0+5","Results discussion":"gp;consult_room",
"Minor procedure in clinic (cyst excision, IUD insertion)":"gp|obgyn;nurse;procedure_room","Nurse-led clinic":"nurse;consult_room",
"Group visit / shared medical appointment":"group_room;gp;diabetes_educator",
"Ophthalmology consultation":"ophthalmologist@10+20;optometrist@0+10;eye_suite","ENT consultation":"ent;consult_room",
"Cardiology consultation":"cardiologist@5+15;consult_room;ecg_machine@0+5;ecg_tech@0+5","Dermatology consultation":"dermatologist;consult_room",
"Obstetrics / gynecology consultation":"obgyn;nurse;consult_room","Pediatric consultation":"pediatrician;consult_room",
"Oncology consultation":"oncologist;consult_room","Orthopedic consultation":"ortho;consult_room",
"Fracture / plaster clinic":"ortho@0+10;plaster_tech;plaster_room",
"Blood collection (phlebotomy)":"collection_chair;phlebotomist","Fasting blood test":"collection_chair;phlebotomist",
"Glucose tolerance test":"collection_chair;phlebotomist@0+5;phlebotomist@60+5;phlebotomist@120+5",
"Urine / stool sample collection":"sample_washroom","Pediatric blood collection":"collection_chair;phlebotomist;nurse",
"Bone marrow aspiration / biopsy":"hematologist;nurse;procedure_room","FNAC (fine needle aspiration)":"pathologist;lab_tech;procedure_room",
"Genetic counseling / testing":"genetic_counselor;consult_room","Drug / alcohol screening":"sample_washroom;lab_tech",
"X-ray":"xray_unit;radiographer","Ultrasound":"us_unit;radiologist","Doppler ultrasound":"us_unit;radiologist",
"CT scan (plain)":"ct_scanner;radiographer",
"CT scan with contrast":"ct_scanner@15+15;radiographer@15+15;nurse@0+15;prep_bay@0+15;radiologist@15+15",
"MRI":"mri_scanner;mri_tech","MRI under sedation / anesthesia":"mri_scanner@0+60;mri_tech@0+60;anesthetist@0+60;nurse@0+90;recovery_bay@60+30",
"Mammography":"mammo_unit;radiographer","DEXA (bone density)":"dexa;radiographer",
"PET-CT":"pet_ct@60+40;uptake_room@0+60;nuc_tech@0+10;nuc_tech@60+40;radiologist@100+20",
"Nuclear medicine scan (bone, thyroid, renal)":"gamma_camera@150+30;nuc_tech@0+10;nuc_tech@150+30",
"Fluoroscopy (barium studies)":"fluoro_unit;radiologist;radiographer",
"Interventional radiology procedure":"ir_suite@0+90;radiologist@0+90;nurse@0+90;radiographer@0+90;recovery_bay@90+60",
"ECG":"ecg_machine;ecg_tech","Echocardiogram":"echo_machine;ecg_tech","Treadmill stress test (TMT)":"tmt_machine;ecg_tech;cardiologist",
"Holter / ambulatory BP fitting":"holter@0+1440;ecg_tech@0+15","EEG":"eeg_machine;eeg_tech",
"EMG / nerve conduction study":"emg_machine;neurologist","Pulmonary function test":"pft_lab;resp_tech",
"Sleep study (polysomnography)":"sleep_bed;sleep_tech","Audiometry":"audio_booth;audiologist",
"Upper GI endoscopy":"endo_suite@0+30;gastro@0+30;endo_nurse@0+30;anesthetist@0+30;recovery_bay@30+30",
"Colonoscopy":"endo_suite@0+45;gastro@0+45;endo_nurse@0+45;anesthetist@0+45;recovery_bay@45+30",
"Bronchoscopy":"bronch_suite@0+45;pulmonologist@0+45;nurse@0+45;anesthetist@0+45;recovery_bay@45+30",
"Cardiac catheterization / angiography":"cath_lab@0+60;cardiologist@0+60;nurse@0+60;cath_tech@0+60;radiographer@0+60;recovery_bay@60+120",
"Allergy skin prick test":"procedure_room;allergist@0+15;nurse","Urodynamic study":"urodynamics;urologist;nurse",
"Pre-anesthesia check (PAC)":"anesthetist;consult_room",
"Pre-operative work-up bundle":"collection_chair@0+10;phlebotomist@0+10;ecg_machine@20+10;ecg_tech@20+10;xray_unit@40+10;radiographer@40+10;anesthetist@60+20;consult_room@60+20",
"Major elective surgery":"ot@0+180;surgeon@0+180;asst_surgeon@0+180;anesthetist@0+180;scrub_nurse@0+180;nurse@0+180;ot_tech@0+180;pacu_bed@180+60",
"Day-care surgery (e.g., cataract, hernia)":"ot@0+60;surgeon@0+60;anesthetist@0+60;scrub_nurse@0+60;daycare_bed@60+180",
"Minor surgery (local anesthesia)":"minor_ot;surgeon;nurse",
"Laparoscopic surgery":"ot@0+120;surgeon@0+120;asst_surgeon@0+120;anesthetist@0+120;scrub_nurse@0+120;nurse@0+120;lap_tower@0+120;pacu_bed@120+60",
"Robotic surgery":"robot@0+240;ot@0+240;surgeon@0+240;asst_surgeon@0+240;anesthetist@0+240;scrub_nurse@0+240;nurse@0+240;pacu_bed@240+60",
"Organ transplant surgery":"ot@0+360;ot@0+360;surgeon@0+360;surgeon@0+360;asst_surgeon@0+360;anesthetist@0+360;anesthetist@0+360;scrub_nurse@0+360;scrub_nurse@0+360;perfusionist@0+360;transplant_coord@0+60;icu_bed@360+1440",
"Emergency surgery slot":"ot;surgeon;anesthetist;scrub_nurse","Post-op review":"surgeon;consult_room",
"Wound dressing":"dressing_room;nurse","Suture / staple removal":"nurse;dressing_room",
"Elective admission":"ward_bed;registration_staff@0+15","Day-care admission":"daycare_bed","Planned ICU bed (post major surgery)":"icu_bed",
"Isolation room booking":"isolation_room","Labour and delivery booking":"labour_room;midwife;obgyn@420+60;neonatologist@450+30",
"Elective caesarean section":"ot@0+90;obgyn@0+90;asst_surgeon@0+90;anesthetist@0+90;neonatologist@30+30;scrub_nurse@0+90;pacu_bed@90+60",
"Discharge planning meeting":"case_manager;nurse;social_worker",
"Dental check-up":"dental_chair;dentist;dental_assistant","Scaling and polishing":"dental_chair;hygienist",
"Filling":"dental_chair;dentist;dental_assistant","Root canal treatment":"dental_chair;endodontist;dental_assistant",
"Tooth extraction":"dental_chair;dentist;dental_assistant","Surgical / wisdom tooth extraction":"dental_chair;oral_surgeon;dental_assistant",
"Dental X-ray (IOPA / OPG / CBCT)":"opg;dental_assistant","Orthodontic adjustment":"dental_chair;orthodontist",
"Crown / bridge / denture":"dental_chair;prosthodontist;dental_assistant","Dental implant surgery":"dental_chair;implantologist;dental_assistant",
"Pediatric dental visit":"dental_chair;pedodontist;dental_assistant",
"Dental treatment under general anesthesia":"ot@0+90;dentist@0+90;anesthetist@0+90;nurse@0+90;pacu_bed@90+45",
"Physiotherapy session":"physio;physio_cubicle","Hydrotherapy":"hydro_pool;physio","Occupational therapy":"occ_therapist;therapy_room",
"Speech and language therapy":"speech_therapist;therapy_room","Cardiac rehabilitation":"rehab_gym;physio;cardiac_nurse",
"Pulmonary rehabilitation":"rehab_gym;physio;resp_tech","Prosthetic / orthotic fitting":"prosthetist;therapy_room",
"Chiropractic session":"chiropractor;physio_cubicle",
"Psychiatry consultation":"psychiatrist;consult_room","Psychotherapy / counseling":"psychologist|counselor;therapy_room",
"Psychological assessment":"psychologist;therapy_room","Group therapy":"group_room;psychologist;counselor",
"Family / couples therapy":"family_therapist;therapy_room","Opioid substitution dosing":"pharmacy_counter;pharmacist",
"Electroconvulsive therapy (ECT)":"ect_suite@0+30;psychiatrist@0+30;anesthetist@0+30;nurse@0+30;recovery_bay@30+30",
"Antenatal visit":"obgyn|midwife;consult_room","Pregnancy scan (NT / anomaly / growth)":"us_unit;fetal_medicine",
"Postnatal check":"obgyn|midwife;consult_room","Lactation consultation":"lactation;therapy_room",
"Well-baby visit":"pediatrician;consult_room;nurse@0+5","Childhood immunization":"nurse;injection_room",
"Fertility consultation":"fertility_specialist;consult_room","IUI (intrauterine insemination)":"procedure_room;fertility_specialist;andrology_tech@-60+45;ivf_lab@-60+45",
"IVF egg retrieval (OPU)":"procedure_room@0+30;fertility_specialist@0+30;embryologist@0+60;anesthetist@0+30;ivf_lab@0+60;recovery_bay@30+60",
"Embryo transfer":"procedure_room;fertility_specialist;embryologist;ivf_lab",
"Hemodialysis":"dialysis_station;dialysis_nurse","Peritoneal dialysis training":"dialysis_nurse;therapy_room",
"Chemotherapy infusion":"chemo_chair;oncology_nurse;clean_room@-45+30;oncology_pharmacist@-45+30",
"Radiotherapy simulation / planning":"ct_sim;rad_therapist;physicist","Radiotherapy session":"linac;rad_therapist;rad_therapist",
"Brachytherapy":"afterloader;rad_oncologist;physicist;anesthetist","Infusion therapy (biologics, IV iron)":"infusion_chair;nurse@0+15",
"Day-care blood transfusion":"daycare_bed;nurse@0+20","Injection visit (B12, depot, hormone)":"nurse;injection_room",
"Hyperbaric oxygen therapy":"hbot;hbot_tech","Wound care clinic":"wound_nurse;dressing_room","Phototherapy (dermatology)":"photo_cabin;nurse@0+5",
"Adult / travel vaccination":"nurse;injection_room",
"Health check-up package":"package_coord@0+15;collection_chair@15+10;phlebotomist@15+10;ecg_machine@30+10;ecg_tech@30+10;xray_unit@45+10;radiographer@45+10;us_unit@60+20;radiologist@60+20;tmt_machine@90+30;cardiologist@90+30;gp@180+30;consult_room@180+30;dietitian@210+30",
"Executive health check":"package_coord@0+15;collection_chair@15+10;phlebotomist@15+10;ecg_machine@30+10;ecg_tech@30+10;xray_unit@45+10;radiographer@45+10;us_unit@60+20;radiologist@60+20;echo_machine@90+30;ecg_tech@90+30;tmt_machine@130+30;cardiologist@130+30;pft_lab@170+20;resp_tech@170+20;gp@300+30;consult_room@300+30;dietitian@330+30",
"Pap smear / cervical screening":"obgyn|nurse;procedure_room",
"Pre-employment medical":"gp@0+15;consult_room@0+15;collection_chair@20+10;phlebotomist@20+10;xray_unit@40+10;radiographer@40+10",
"Visa / immigration medical":"panel_physician@0+20;consult_room@0+20;collection_chair@30+10;phlebotomist@30+10;xray_unit@50+10;radiographer@50+10",
"Fitness / driving certificate":"gp;consult_room","Travel medicine consultation":"gp;consult_room",
"Occupational health surveillance":"occ_physician@0+15;consult_room@0+15;audio_booth@20+20;audiologist@20+20;pft_lab@45+15;resp_tech@45+15",
"Prescription pickup":"pharmacy_counter;pharmacist","Refill pickup":"pharmacy_counter;pharm_tech",
"Medication therapy review":"clinical_pharmacist;counsel_booth","New medication counseling":"pharmacist;counsel_booth",
"Pharmacy vaccination":"pharmacist;counsel_booth","Anticoagulation (INR) clinic":"clinical_pharmacist;counsel_booth",
"Device training (inhaler, insulin pen, glucometer)":"pharmacist;counsel_booth","Specialty drug dispensing":"clinical_pharmacist;pharmacy_counter",
"Compounding / IV admixture":"clean_room;pharmacist;pharm_tech","Home delivery slot":"delivery_van;delivery_staff",
"Doctor home visit":"home_physician;home_car;driver","Home nursing visit":"home_nurse","Home physiotherapy":"home_physio",
"Home sample collection":"phlebotomist","Home wound care":"home_nurse","Home IV / infusion therapy":"home_nurse;pharmacist@-60+20",
"Palliative care home visit":"palliative_physician;home_nurse;social_worker","Elderly care / caregiver visit":"caregiver",
"Postnatal home visit":"midwife","Portable X-ray / ECG at home":"portable_xray;radiographer;driver",
"Medical equipment delivery and setup":"delivery_van;biomed_tech",
"Dietitian consultation":"dietitian;consult_room","Diabetes education":"diabetes_educator;therapy_room",
"Podiatry / diabetic foot care":"podiatrist;procedure_room","Optometry / eye test":"optometrist;eye_suite",
"Hearing aid fitting":"audiologist;audio_booth","Smoking cessation":"counselor;therapy_room","Weight management":"dietitian|gp;consult_room",
"Ayurveda consultation":"ayurveda;consult_room","Panchakarma therapy":"panchakarma_room;panchakarma_therapist;panchakarma_therapist",
"Acupuncture":"acupuncturist;therapy_room","Homeopathy consultation":"homeopath;consult_room",
"Video consultation":"gp","Phone consultation":"gp","Chat / asynchronous consultation":"gp","Remote monitoring review":"nurse",
"E-prescription renewal":"gp",
"Urgent care slot":"urgent_physician;urgent_cubicle","Emergency fast-track":"ed_physician;triage_nurse@0+10;urgent_cubicle",
"Triage call-back":"triage_nurse",
"Whole blood donation":"donor_couch;phlebotomist;donor_mo@0+10","Apheresis (platelet / plasma)":"apheresis;apheresis_tech;donor_mo@0+10",
"Transplant evaluation":"transplant_coord;nephrologist@0+45;consult_room@0+45;collection_chair@60+10;phlebotomist@60+10;us_unit@90+20;radiologist@90+20;social_worker@120+40",
"Stem cell collection":"apheresis;hematologist@0+20;oncology_nurse",
"Patient registration":"front_desk;registration_staff","Insurance pre-authorization":"insurance_coord",
"Financial / billing counseling":"billing_counselor","Medical records / report collection":"records_desk;records_staff",
"Medical certificate":"gp;consult_room","Interpreter booking":"interpreter",
"Multidisciplinary team (MDT) / tumor board":"conference_room;oncologist;surgeon;radiologist;pathologist;rad_oncologist",
"Patient transport / ambulance":"ambulance;driver;paramedic",
}
VARIES = {"Emergency surgery slot":120,"Elective admission":2880,"Planned ICU bed (post major surgery)":1440,"Isolation room booking":1440,
 "Labour and delivery booking":480,"Interpreter booking":30,"Patient transport / ambulance":60,"Transplant evaluation":240,"Emergency fast-track":60}
# start-time windows (minute of day) where the patient may start
WINDOWS = {"Fasting blood test":("06:30","10:00"),"Glucose tolerance test":("07:00","10:00"),"Sleep study (polysomnography)":("20:00","22:00"),
 "Health check-up package":("07:00","09:00"),"Executive health check":("07:00","08:30"),"Major elective surgery":("08:00","16:00"),
 "Laparoscopic surgery":("08:00","17:00"),"Robotic surgery":("08:00","15:00"),"Organ transplant surgery":("08:00","13:00"),
 "Elective admission":("08:00","18:00"),"Chemotherapy infusion":("08:00","15:00"),"Colonoscopy":("08:00","16:00"),
 "Upper GI endoscopy":("08:00","17:00"),"PET-CT":("08:30","14:00")}
NOTICE = {"Major elective surgery":1440,"Laparoscopic surgery":1440,"Robotic surgery":2880,"PET-CT":1440,"Organ transplant surgery":2880,
 "Chemotherapy infusion":120,"Elective caesarean section":1440,"Colonoscopy":1440,"Health check-up package":720,"Executive health check":720}
PREP = [
 (r"fast|Fasting|GTT|Glucose tolerance","Fast for 8-10 hours before arrival; water is allowed."),
 (r"Colonoscopy","Start bowel preparation the evening before as instructed; clear liquids only after noon."),
 (r"endoscopy|Bronchoscopy","Nothing by mouth for 6 hours. Arrange an escort home after sedation."),
 (r"MRI","Remove all metal. Tell the team about implants, pacemakers or pregnancy."),
 (r"contrast","Bring a recent creatinine report. Tell the team about contrast or iodine allergy."),
 (r"PET","Fast for 6 hours and avoid strenuous exercise for 24 hours."),
 (r"Ultrasound|scan \(NT","Some abdominal or pelvic scans need a full bladder; drink 4 glasses of water 1 hour before."),
 (r"surgery|Surgical|caesarean|OPU|transplant","Follow the fasting instructions from the pre-anesthesia check. Bring consent forms and prior reports."),
 (r"Sleep study","Arrive by 8:30 pm after a light dinner. Avoid caffeine after noon."),
 (r"Stress test|TMT","Wear comfortable shoes. Avoid a heavy meal for 3 hours before."),
 (r"Holter","Wear a loose top. Return the device after 24-48 hours."),
 (r"Dialysis|Hemodialysis","Record your weight before the session and bring your dialysis card."),
 (r"Chemotherapy","Blood counts must be cleared on the same morning before drug preparation starts."),
 (r"Visa","Bring passport, photographs and the embassy reference number."),
 (r"EEG","Wash hair the night before; no oil or gel."),
]
def prep_for(name, notes):
    t = name + " " + (notes or "")
    for pat, txt in PREP:
        if re.search(pat, t, re.I): return txt
    return None

def slot_step(d, pattern, name):
    if d >= 1440: return 60
    if d >= 180: return 30
    if d >= 60: return 15
    if pattern.startswith("Chair") or d <= 10: return 5
    return min(15, d) if d % 5 == 0 else 5

def slot_model(pattern, name, mode):
    if "Varies" in str(name): return "open"
    if name in ("Walk-in visit","Emergency fast-track","Chat / asynchronous consultation"): return "open"
    if pattern == "Chair / bed / room-based": return "capacity"
    if "surgery" in name.lower() or "theatre" in name.lower() or name.startswith("Organ"): return "block"
    return "fixed"

cats=[]
for r in rows:
    if r[0] not in cats: cats.append(r[0])
CAT_ICON = {"Outpatient":"stethoscope","Specialty clinic":"heart-pulse","Laboratory":"test-tube","Radiology":"scan","Other diagnostics":"activity",
 "Surgical":"scissors","Inpatient":"bed","Dental":"smile","Rehabilitation":"footprints","Mental health":"brain","Maternal and child health":"baby",
 "Recurring treatment":"repeat","Preventive and occupational":"shield-check","Pharmacy":"pill","Home care":"house","Allied health":"apple",
 "Complementary medicine":"leaf","Virtual care":"video","Emergency and urgent care":"siren","Blood bank and transplant":"droplet",
 "Administrative and support":"clipboard-list"}
CAT_DEPT = {"Outpatient":"OPD","Specialty clinic":"SPEC","Laboratory":"LAB","Radiology":"RAD","Other diagnostics":"DIAG","Surgical":"SURG",
 "Inpatient":"IPD","Dental":"DENT","Rehabilitation":"REHAB","Mental health":"MH","Maternal and child health":"MCH","Recurring treatment":"ONCO",
 "Preventive and occupational":"PREV","Pharmacy":"PHARM","Home care":"HOME","Allied health":"ALLIED","Complementary medicine":"WELL",
 "Virtual care":"VIRT","Emergency and urgent care":"EMER","Blood bank and transplant":"BLOOD","Administrative and support":"ADMIN"}
for i,c in enumerate(cats,1):
    out.append(ins("categories",["id","name","icon","department_id","sort"],[i,c,CAT_ICON[c],dept_id[CAT_DEPT[c]],i]))
cat_id={c:i for i,c in enumerate(cats,1)}

missing=[r[1] for r in rows if r[1] not in SPEC]
assert not missing, missing
reqid=0
for i,r in enumerate(rows,1):
    cat,name,setting,mode,primary,pkind,staff,room,equip,pattern,dur,rec,notes=r
    d = VARIES.get(name, dur if isinstance(dur,int) else 60)
    w = WINDOWS.get(name)
    travel = 15 if mode == "Home" else 0
    out.append(ins("appointment_types",
        ["id","category_id","name","setting","mode","pattern","duration_min","slot_step_min","slot_model","min_notice_min","max_advance_days",
         "window_start","window_end","recurring","travel_min","notes","prep_instructions","requires_consent","active"],
        [i,cat_id[cat],name,setting,mode,pattern,d,slot_step(d,pattern,name),slot_model(pattern,name if dur!="Varies" else "Varies",mode),
         NOTICE.get(name,0),180 if rec=="Y" else 90, hm(w[0]) if w else None, hm(w[1]) if w else None,1 if rec=="Y" else 0,travel,
         notes or None, prep_for(name,notes), 1 if re.search(r"surgery|procedure|biopsy|ECT|OPU|transfusion|catheter|endoscopy|Colonoscopy|Bronchoscopy|sedation",name,re.I) else 0, 1]))
    for seq,tok in enumerate(SPEC[name].split(";")):
        m=re.match(r"^([a-z_|]+)(?:@(-?\d+)\+(\d+))?$",tok)
        assert m, tok
        roles_=m.group(1).split("|")
        for ro in roles_: assert ro in ROLES, (name, ro)
        off=int(m.group(2)) if m.group(2) else 0
        du=int(m.group(3)) if m.group(3) else None
        reqid+=1
        out.append(ins("type_requirements",["id","type_id","seq","role_codes","offset_min","duration_min","is_primary"],
                       [reqid,i,seq,"|".join(roles_),off,du,1 if seq==0 else 0]))

# patients (demo)
LANGS=["English","Hindi","Tamil","Malayalam","Kannada","Telugu","Bengali","Arabic","Marathi","Urdu"]
PAYERS=["Self pay","Star Health","HDFC ERGO","ICICI Lombard","CGHS","Corporate - Infosys","Niva Bupa","Government scheme"]
for i in range(1,601):
    g=random.choice(["Female","Male"])
    name=person_name(False)
    age=random.choice([2,5,8,15,24,29,33,38,41,47,52,58,63,67,71,76,82])
    yr=2026-age
    lang=random.choice(LANGS)
    out.append(ins("patients",["id","mrn","full_name","gender","dob","phone","email","language","interpreter_needed","mobility","allergies","payer","preferred_channel","notes"],
        [i,f"CG-{100200+i*7}",name,g,f"{yr}-{random.randint(1,12):02d}-{random.randint(1,28):02d}",f"+91 9{random.randint(100000000,999999999)}",
         name.lower().replace(' ','.').replace("'","")+"@example.com",lang,1 if lang in ("Arabic","Bengali") else 0,
         random.choice(["Independent","Independent","Independent","Wheelchair","Walker","Stretcher"]) ,
         random.choice([None,None,None,"Penicillin","Iodinated contrast","Latex","Sulfa drugs"]),random.choice(PAYERS),
         random.choice(["SMS","WhatsApp","Email","Phone call"]),None]))

open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'db', 'reference.sql'),'w').write("\n".join(out)+"\n")
print("resources",rid,"templates",tid,"types",len(rows),"reqs",reqid)
