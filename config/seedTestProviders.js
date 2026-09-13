const bcrypt = require('bcrypt');
const { pool, query } = require('./db');

const SHARED_PASSWORD = 'Test@1234';
const PASSWORD_ROUNDS = 10;
const DOCTOR_EMAIL_VERIFIED_AT = '2026-01-15T08:00:00.000Z';
const PHARMACY_EMAIL_VERIFIED_AT = '2026-01-18T09:30:00.000Z';
const ANCHOR = { lat: -26.0565, lng: 28.0227 };
const KM_PER_DEG_LAT = 1 / 111;
const KM_PER_DEG_LNG = 1 / 101;

function offset(latKm, lngKm) {
  return {
    latitude: +(ANCHOR.lat + latKm * KM_PER_DEG_LAT).toFixed(6),
    longitude: +(ANCHOR.lng + lngKm * KM_PER_DEG_LNG).toFixed(6),
  };
}

function buildDoctorAvailability(weekdayHours, saturdayHours) {
  return {
    monday: weekdayHours,
    tuesday: weekdayHours,
    wednesday: weekdayHours,
    thursday: weekdayHours,
    friday: weekdayHours,
    saturday: saturdayHours,
    sunday: [],
  };
}

function buildOperatingHours(weekday, saturday, sunday) {
  return {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: saturday,
    sunday: sunday,
  };
}

const DOCTORS = [
  {
    first_name: 'Sam',
    last_name: 'Smith',
    email: 'seed.doc1@seed.test',
    phone: '+27110000001',
    hpcsa_number: 'SEED-DR-0001',
    specialization: 'General Practitioner',
    experience: 10,
    clinic_name: 'Bryanston Family Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCFP (SA)',
    address: '12 Ballyclare Drive, Bryanston, Johannesburg',
    clinic_address: '12 Ballyclare Drive, Bryanston, Johannesburg',
    zip_code: '2191',
    suburb: 'Bryanston',
    consultation_fee: 250,
    bio: 'Family medicine practitioner focused on preventative care, chronic disease reviews, and urgent same-day consultations.',
    details: 'Offers in-person and follow-up telephonic consultations. Fluent in English and Setswana. Accepts walk-ins when slots are available.',
    rating: 4.9,
    review_count: 2500,
    currency: 'ZAR',
    opens_at: '07:00',
    closes_at: '18:00',
    availability: buildDoctorAvailability(['07:00-12:30', '13:30-18:00'], ['08:00-13:00']),
    profile_image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(1, 0),
  },
  {
    first_name: 'Lerato',
    last_name: 'Moloi',
    email: 'seed.doc2@seed.test',
    phone: '+27110000002',
    hpcsa_number: 'SEED-DR-0002',
    specialization: 'Paediatrician',
    experience: 7,
    clinic_name: 'Sandton Kids Health',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCPaed (SA)',
    address: '85 Rivonia Road, Sandton, Johannesburg',
    clinic_address: '85 Rivonia Road, Sandton, Johannesburg',
    zip_code: '2196',
    suburb: 'Sandton',
    consultation_fee: 450,
    bio: 'Paediatric specialist supporting newborn, infant, and adolescent care with a strong focus on developmental milestones.',
    details: 'Provides vaccination counselling, asthma management, and nutrition plans for children with chronic conditions.',
    rating: 4.8,
    review_count: 1840,
    currency: 'ZAR',
    opens_at: '08:00',
    closes_at: '17:00',
    availability: buildDoctorAvailability(['08:00-12:00', '13:00-17:00'], ['08:00-12:00']),
    profile_image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(0, 3),
  },
  {
    first_name: 'Thabo',
    last_name: 'Nkosi',
    email: 'seed.doc3@seed.test',
    phone: '+27110000003',
    hpcsa_number: 'SEED-DR-0003',
    specialization: 'Dermatologist',
    experience: 12,
    clinic_name: 'Randburg Skin Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FC Derm (SA)',
    address: '44 Republic Road, Randburg, Johannesburg',
    clinic_address: '44 Republic Road, Randburg, Johannesburg',
    zip_code: '2194',
    suburb: 'Randburg',
    consultation_fee: 600,
    bio: 'Dermatology consultant managing acne, eczema, psoriasis, and procedural dermatology for adults and teens.',
    details: 'Offers biopsy follow-ups, mole mapping, and treatment planning for long-term inflammatory skin conditions.',
    rating: 4.6,
    review_count: 980,
    currency: 'ZAR',
    opens_at: '09:00',
    closes_at: '18:00',
    availability: buildDoctorAvailability(['09:00-13:00', '14:00-18:00'], ['09:00-13:00']),
    profile_image: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-3.5, -3.5),
  },
  {
    first_name: 'Aisha',
    last_name: 'Patel',
    email: 'seed.doc4@seed.test',
    phone: '+27110000004',
    hpcsa_number: 'SEED-DR-0004',
    specialization: 'General Practitioner',
    experience: 5,
    clinic_name: 'Fourways Medical Centre',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB',
    address: '203 Cedar Road, Fourways, Johannesburg',
    clinic_address: '203 Cedar Road, Fourways, Johannesburg',
    zip_code: '2055',
    suburb: 'Fourways',
    consultation_fee: 300,
    bio: 'Primary care doctor offering women’s health, acute illness management, and routine wellness checks.',
    details: 'Known for short wait times and practical treatment plans for recurring primary care issues.',
    rating: 4.5,
    review_count: 430,
    currency: 'ZAR',
    opens_at: '07:00',
    closes_at: '19:00',
    availability: buildDoctorAvailability(['07:00-12:00', '13:00-19:00'], ['08:00-13:00']),
    profile_image: 'https://images.unsplash.com/photo-1594824388853-d0caca0e2a85?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(5.5, 5.5),
  },
  {
    first_name: 'Sipho',
    last_name: 'Dlamini',
    email: 'seed.doc5@seed.test',
    phone: '+27110000005',
    hpcsa_number: 'SEED-DR-0005',
    specialization: 'Cardiologist',
    experience: 20,
    clinic_name: 'Edenvale Heart Institute',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCP (SA), Cert Cardiology',
    address: '17 Van Riebeeck Avenue, Edenvale, Johannesburg',
    clinic_address: '17 Van Riebeeck Avenue, Edenvale, Johannesburg',
    zip_code: '1609',
    suburb: 'Edenvale',
    consultation_fee: 1200,
    bio: 'Consultant cardiologist with long-form diagnostic appointments for chest pain, hypertension, and rhythm disorders.',
    details: 'Supports referral-based assessments, ECG interpretation, and longitudinal management for cardiac patients.',
    rating: 4.8,
    review_count: 3100,
    currency: 'ZAR',
    opens_at: '08:00',
    closes_at: '16:00',
    availability: buildDoctorAvailability(['08:00-12:00', '13:00-16:00'], []),
    profile_image: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(0, 15),
  },
  {
    first_name: 'Naledi',
    last_name: 'Mokoena',
    email: 'seed.doc6@seed.test',
    phone: '+27110000006',
    hpcsa_number: 'SEED-DR-0006',
    specialization: 'Gynaecologist',
    experience: 14,
    clinic_name: 'Rosebank Women’s Centre',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCOG (SA)',
    address: '61 Jan Smuts Avenue, Rosebank, Johannesburg',
    clinic_address: '61 Jan Smuts Avenue, Rosebank, Johannesburg',
    zip_code: '2196',
    suburb: 'Rosebank',
    consultation_fee: 850,
    bio: 'Women’s health specialist delivering consults across fertility planning, antenatal care, and menstrual health.',
    details: 'Handles both referral and direct bookings with dedicated counselling time for first-visit patients.',
    rating: 4.9,
    review_count: 2120,
    currency: 'ZAR',
    opens_at: '08:30',
    closes_at: '17:30',
    availability: buildDoctorAvailability(['08:30-13:00', '14:00-17:30'], ['09:00-13:00']),
    profile_image: 'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-1.5, 2),
  },
  {
    first_name: 'Daniel',
    last_name: 'Mthembu',
    email: 'seed.doc7@seed.test',
    phone: '+27110000007',
    hpcsa_number: 'SEED-DR-0007',
    specialization: 'Orthopaedic Surgeon',
    experience: 16,
    clinic_name: 'Parktown Ortho Clinic',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FC Orth (SA)',
    address: '9 Empire Road, Parktown, Johannesburg',
    clinic_address: '9 Empire Road, Parktown, Johannesburg',
    zip_code: '2193',
    suburb: 'Parktown',
    consultation_fee: 950,
    bio: 'Orthopaedic surgeon focused on sports injuries, trauma follow-up, and joint pain management.',
    details: 'Useful for testing specialist discovery and higher-fee filtering on the doctor listing flow.',
    rating: 4.7,
    review_count: 1410,
    currency: 'ZAR',
    opens_at: '07:30',
    closes_at: '16:30',
    availability: buildDoctorAvailability(['07:30-12:30', '13:30-16:30'], []),
    profile_image: 'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(1, -1),
  },
  {
    first_name: 'Zanele',
    last_name: 'Khumalo',
    email: 'seed.doc8@seed.test',
    phone: '+27110000008',
    hpcsa_number: 'SEED-DR-0008',
    specialization: 'Psychiatrist',
    experience: 11,
    clinic_name: 'Melrose Mental Wellness',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCPsych (SA)',
    address: '28 Corlett Drive, Melrose, Johannesburg',
    clinic_address: '28 Corlett Drive, Melrose, Johannesburg',
    zip_code: '2196',
    suburb: 'Melrose',
    consultation_fee: 1100,
    bio: 'Adult psychiatrist supporting mood disorders, anxiety care, medication reviews, and coordinated therapy plans.',
    details: 'Provides longer first consultations and structured follow-up planning for continuity-of-care testing.',
    rating: 4.8,
    review_count: 860,
    currency: 'ZAR',
    opens_at: '09:00',
    closes_at: '17:00',
    availability: buildDoctorAvailability(['09:00-13:00', '14:00-17:00'], ['09:00-12:00']),
    profile_image: 'https://images.unsplash.com/photo-1612531385446-f7b6b1b1f734?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-2, 1),
  },
  {
    first_name: 'Michael',
    last_name: 'van Wyk',
    email: 'seed.doc9@seed.test',
    phone: '+27110000009',
    hpcsa_number: 'SEED-DR-0009',
    specialization: 'ENT Specialist',
    experience: 13,
    clinic_name: 'Bedford ENT Rooms',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FCORL (SA)',
    address: '102 Bradford Road, Bedfordview, Johannesburg',
    clinic_address: '102 Bradford Road, Bedfordview, Johannesburg',
    zip_code: '2007',
    suburb: 'Bedfordview',
    consultation_fee: 780,
    bio: 'Ear, nose, and throat specialist handling sinus disease, hearing issues, and recurrent throat infections.',
    details: 'Balanced specialist profile for testing location filtering outside Sandton while staying within Johannesburg.',
    rating: 4.7,
    review_count: 1195,
    currency: 'ZAR',
    opens_at: '08:00',
    closes_at: '17:00',
    availability: buildDoctorAvailability(['08:00-12:00', '13:00-17:00'], ['08:00-11:00']),
    profile_image: 'https://images.unsplash.com/photo-1551601651-bc60f254d532?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(0.5, 9),
  },
  {
    first_name: 'Karabo',
    last_name: 'Selepe',
    email: 'seed.doc10@seed.test',
    phone: '+27110000010',
    hpcsa_number: 'SEED-DR-0010',
    specialization: 'Neurologist',
    experience: 18,
    clinic_name: 'Midrand Neuro Centre',
    city: 'Johannesburg',
    province: 'Gauteng',
    qualification: 'MBChB, FC Neurol (SA)',
    address: '74 New Road, Midrand, Johannesburg',
    clinic_address: '74 New Road, Midrand, Johannesburg',
    zip_code: '1685',
    suburb: 'Midrand',
    consultation_fee: 1350,
    bio: 'Neurology consultant managing headaches, neuropathy, seizure evaluation, and neurodiagnostic follow-up.',
    details: 'Useful for high-fee specialist scenarios and appointment selection tests across suburb boundaries.',
    rating: 4.9,
    review_count: 1660,
    currency: 'ZAR',
    opens_at: '08:00',
    closes_at: '16:30',
    availability: buildDoctorAvailability(['08:00-12:30', '13:30-16:30'], []),
    profile_image: 'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=600&q=80',
    email_verified: true,
    email_verified_at: DOCTOR_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(3, -2),
  },
];

const PHARMACIES = [
  {
    pharmacy_name: 'Bryanston Central Pharmacy',
    first_name: 'Alice',
    last_name: 'Johnson',
    email: 'seed.pharm1@seed.test',
    phone: '+27110001001',
    license_number: 'SEED-PHARM-0001',
    city: 'Bryanston',
    province: 'Gauteng',
    address: '123 Main Street, Bryanston, Johannesburg',
    zip_code: '2191',
    services: ['prescription_filling', 'health_screening', 'vaccination', 'delivery'],
    delivery_available: true,
    delivery_radius: 5,
    is_24_hours: true,
    website: 'https://bryanston-central.seed.test',
    description: 'Full-service pharmacy with vaccination support, repeat script management, and all-day urgent dispensing.',
    profile_image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['00:00-23:59'], ['00:00-23:59'], ['00:00-23:59']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(0, 0),
  },
  {
    pharmacy_name: 'Sandton Premium Pharmacy',
    first_name: 'Bob',
    last_name: 'Smith',
    email: 'seed.pharm2@seed.test',
    phone: '+27110002002',
    license_number: 'SEED-PHARM-0002',
    city: 'Sandton',
    province: 'Gauteng',
    address: '456 Commerce Road, Sandton, Johannesburg',
    zip_code: '2146',
    services: ['prescription_filling', 'compounding', 'health_screening'],
    delivery_available: true,
    delivery_radius: 10,
    is_24_hours: false,
    website: 'https://sandton-premium.seed.test',
    description: 'Premium dispensing and compounded medication service with dedicated script collection workflow.',
    profile_image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-18:00'], ['09:00-14:00'], []),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(2, 1.5),
  },
  {
    pharmacy_name: 'Rosebank Healthcare Pharmacy',
    first_name: 'Carol',
    last_name: 'Williams',
    email: 'seed.pharm3@seed.test',
    phone: '+27110003003',
    license_number: 'SEED-PHARM-0003',
    city: 'Rosebank',
    province: 'Gauteng',
    address: '789 Park Lane, Rosebank, Johannesburg',
    zip_code: '2196',
    services: ['prescription_filling', 'health_screening', 'vaccination'],
    delivery_available: false,
    delivery_radius: 0,
    is_24_hours: false,
    website: 'https://rosebank-health.seed.test',
    description: 'Community-oriented pharmacy with strong counselling support and prescription follow-up service.',
    profile_image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-17:30'], ['09:00-13:00'], []),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-1.5, 2),
  },
  {
    pharmacy_name: 'Midrand Quick Pharmacy',
    first_name: 'David',
    last_name: 'Brown',
    email: 'seed.pharm4@seed.test',
    phone: '+27110004004',
    license_number: 'SEED-PHARM-0004',
    city: 'Midrand',
    province: 'Gauteng',
    address: '321 Tech Street, Midrand, Johannesburg',
    zip_code: '1685',
    services: ['prescription_filling', 'delivery', 'online_ordering'],
    delivery_available: true,
    delivery_radius: 15,
    is_24_hours: true,
    website: 'https://midrand-quick.seed.test',
    description: 'Modern pharmacy built for online repeat orders, same-day packing, and broad delivery coverage.',
    profile_image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['07:00-22:00'], ['08:00-20:00'], ['09:00-17:00']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(3, -2),
  },
  {
    pharmacy_name: 'Randburg Family Pharmacy',
    first_name: 'Eve',
    last_name: 'Davis',
    email: 'seed.pharm5@seed.test',
    phone: '+27110005005',
    license_number: 'SEED-PHARM-0005',
    city: 'Randburg',
    province: 'Gauteng',
    address: '654 Family Road, Randburg, Johannesburg',
    zip_code: '2194',
    services: ['prescription_filling', 'vaccination', 'health_screening', 'delivery'],
    delivery_available: true,
    delivery_radius: 8,
    is_24_hours: false,
    website: 'https://randburg-family.seed.test',
    description: 'Family-focused pharmacy for chronic medication, minor wellness checks, and neighbourhood delivery.',
    profile_image: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-19:00'], ['09:00-16:00'], ['09:00-13:00']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-2.5, -1.5),
  },
  {
    pharmacy_name: 'Johannesburg CBD Pharmacy',
    first_name: 'Frank',
    last_name: 'Miller',
    email: 'seed.pharm6@seed.test',
    phone: '+27110006006',
    license_number: 'SEED-PHARM-0006',
    city: 'Johannesburg',
    province: 'Gauteng',
    address: '987 Central Ave, Johannesburg CBD',
    zip_code: '2000',
    services: ['prescription_filling', 'health_screening'],
    delivery_available: false,
    delivery_radius: 0,
    is_24_hours: true,
    website: 'https://jhb-cbd.seed.test',
    description: 'High-volume CBD pharmacy positioned for commuter testing and fast walk-in pickups.',
    profile_image: 'https://images.unsplash.com/photo-1512678080530-7760d81faba6?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['06:30-22:00'], ['08:00-18:00'], ['09:00-14:00']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-4, 3),
  },
  {
    pharmacy_name: 'Parktown Medical Pharmacy',
    first_name: 'Grace',
    last_name: 'Wilson',
    email: 'seed.pharm7@seed.test',
    phone: '+27110007007',
    license_number: 'SEED-PHARM-0007',
    city: 'Parktown',
    province: 'Gauteng',
    address: '111 Medical Plaza, Parktown, Johannesburg',
    zip_code: '2193',
    services: ['prescription_filling', 'compounding', 'vaccination', 'health_screening'],
    delivery_available: true,
    delivery_radius: 5,
    is_24_hours: false,
    website: 'https://parktown-medical.seed.test',
    description: 'Hospital-adjacent pharmacy that works well for testing specialist-linked medication flows.',
    profile_image: 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-18:00'], ['08:00-14:00'], []),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(1, -1),
  },
  {
    pharmacy_name: 'Soweto Community Pharmacy',
    first_name: 'Henry',
    last_name: 'Taylor',
    email: 'seed.pharm8@seed.test',
    phone: '+27110008008',
    license_number: 'SEED-PHARM-0008',
    city: 'Soweto',
    province: 'Gauteng',
    address: '222 Community Street, Soweto',
    zip_code: '1804',
    services: ['prescription_filling', 'health_screening', 'vaccination', 'delivery'],
    delivery_available: true,
    delivery_radius: 12,
    is_24_hours: false,
    website: 'https://soweto-community.seed.test',
    description: 'Neighbourhood pharmacy with broad delivery coverage and affordable repeat-medication handling.',
    profile_image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-18:00'], ['09:00-15:00'], ['09:00-13:00']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-5, -3),
  },
  {
    pharmacy_name: 'Hillbrow Urgent Care Pharmacy',
    first_name: 'Isabel',
    last_name: 'Anderson',
    email: 'seed.pharm9@seed.test',
    phone: '+27110009009',
    license_number: 'SEED-PHARM-0009',
    city: 'Hillbrow',
    province: 'Gauteng',
    address: '333 Urgent Lane, Hillbrow, Johannesburg',
    zip_code: '2001',
    services: ['prescription_filling', 'emergency_supplies', 'delivery'],
    delivery_available: true,
    delivery_radius: 20,
    is_24_hours: true,
    website: 'https://hillbrow-urgent.seed.test',
    description: 'Urgent care pharmacy carrying after-hours essentials and emergency support stock.',
    profile_image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['00:00-23:59'], ['00:00-23:59'], ['00:00-23:59']),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(-3, 2),
  },
  {
    pharmacy_name: 'Cresta Quality Pharmacy',
    first_name: 'Jack',
    last_name: 'Martinez',
    email: 'seed.pharm10@seed.test',
    phone: '+27110010010',
    license_number: 'SEED-PHARM-0010',
    city: 'Cresta',
    province: 'Gauteng',
    address: '444 Quality Road, Cresta, Johannesburg',
    zip_code: '2118',
    services: ['prescription_filling', 'health_screening', 'vaccination'],
    delivery_available: true,
    delivery_radius: 6,
    is_24_hours: false,
    website: 'https://cresta-quality.seed.test',
    description: 'Balanced suburban pharmacy profile for testing standard discovery, contact, and service display flows.',
    profile_image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=600&q=80',
    operating_hours: buildOperatingHours(['08:00-18:00'], ['09:00-14:00'], []),
    email_verified: true,
    email_verified_at: PHARMACY_EMAIL_VERIFIED_AT,
    status: 'active',
    ...offset(2, -2.5),
  },
];

async function getExistingColumns(tableName) {
  const result = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function prepareRecord(record, columnSet) {
  return Object.fromEntries(
    Object.entries(record).filter(([key, value]) => columnSet.has(key) && value !== undefined)
  );
}

async function upsertByEmail(tableName, record, client) {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const updateAssignments = columns
    .filter((column) => column !== 'email')
    .map((column) => `${column} = EXCLUDED.${column}`)
    .concat('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    INSERT INTO ${tableName} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (email)
    DO UPDATE SET ${updateAssignments.join(', ')}
    RETURNING id, email
  `;

  return client.query(sql, values);
}

async function seedTestProviders() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run provider seed script in production');
  }

  const client = await pool.connect();

  try {
    console.log(`🔄 Seeding ${DOCTORS.length} doctors and ${PHARMACIES.length} pharmacies for testing...`);

    const passwordHash = await bcrypt.hash(SHARED_PASSWORD, PASSWORD_ROUNDS);
    const doctorColumns = await getExistingColumns('doctors');
    const pharmacyColumns = await getExistingColumns('pharmacies');

    await client.query('BEGIN');

    let doctorCount = 0;
    for (const doctor of DOCTORS) {
      const record = prepareRecord({ ...doctor, password_hash: passwordHash }, doctorColumns);
      await upsertByEmail('doctors', record, client);
      doctorCount++;
      console.log(`  ✓ doctor    ${doctor.email}`);
    }

    let pharmacyCount = 0;
    for (const pharmacy of PHARMACIES) {
      const record = prepareRecord({ ...pharmacy, password_hash: passwordHash }, pharmacyColumns);
      await upsertByEmail('pharmacies', record, client);
      pharmacyCount++;
      console.log(`  ✓ pharmacy  ${pharmacy.email}`);
    }

    await client.query('COMMIT');

    console.log(`\n✅ Test provider seed complete. Doctors: ${doctorCount}, Pharmacies: ${pharmacyCount}`);
    console.log(`🔑 Shared password for all seeded doctors and pharmacies: ${SHARED_PASSWORD}`);
    console.log(`📍 Location anchor: lat=${ANCHOR.lat}, lng=${ANCHOR.lng}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedTestProviders()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Provider seed failed:', error);
      pool.end().finally(() => process.exit(1));
    });
}

module.exports = {
  seedTestProviders,
  DOCTORS,
  PHARMACIES,
  SHARED_PASSWORD,
};