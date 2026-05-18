/**
 * Drug Interaction Checking Service
 * Provides real-time drug interaction and contraindication checking
 * Based on common drug interactions and patient profile
 */

class DrugInteractionService {
  // Common drug interactions database
  static DRUG_INTERACTIONS = {
    'warfarin': {
      contraindicated: ['aspirin', 'ibuprofen', 'naproxen', 'amoxicillin'],
      caution: ['paracetamol', 'vitamin k foods'],
      level: 'high'
    },
    'metformin': {
      contraindicated: ['contrast dye'],
      caution: ['alcohol', 'trimethoprim'],
      level: 'medium'
    },
    'lisinopril': {
      contraindicated: ['potassium supplements', 'NSAIDs with high potassium'],
      caution: ['potassium sparing diuretics', 'NSAIDs'],
      level: 'high'
    },
    'atorvastatin': {
      contraindicated: [],
      caution: ['grapefruit juice', 'erythromycin', 'clarithromycin'],
      level: 'medium'
    },
    'sertraline': {
      contraindicated: ['MAOIs', 'tramadol'],
      caution: ['NSAIDs', 'warfarin', 'tricyclic antidepressants'],
      level: 'high'
    },
    'metoprolol': {
      contraindicated: ['verapamil', 'diltiazem'],
      caution: ['NSAIDs', 'rifampicin'],
      level: 'high'
    },
    'omeprazole': {
      contraindicated: [],
      caution: ['clopidogrel', 'ketoconazole'],
      level: 'medium'
    },
    'amoxicillin': {
      contraindicated: ['methotrexate'],
      caution: ['warfarin', 'oral contraceptives'],
      level: 'medium'
    },
    'ciprofloxacin': {
      contraindicated: ['tizanidine'],
      caution: ['warfarin', 'NSAIDs', 'theophylline'],
      level: 'high'
    },
    'ketoconazole': {
      contraindicated: ['terfenadine', 'astemizole'],
      caution: ['statins', 'benzodiazepines', 'protease inhibitors'],
      level: 'high'
    }
  };

  // Patient contraindications based on medical history
  static PATIENT_CONTRAINDICATIONS = {
    'diabetes': ['SGLT2 inhibitors in acute illness', 'corticosteroids high dose'],
    'hypertension': ['NSAIDs', 'decongestants', 'oral contraceptives'],
    'asthma': ['beta blockers', 'NSAIDs', 'ACE inhibitors'],
    'pregnancy': ['ACE inhibitors', 'warfarin', 'tetracyclines', 'retinoids'],
    'renal_disease': ['NSAIDs', 'ACE inhibitors', 'high dose aminoglycosides'],
    'liver_disease': ['paracetamol high dose', 'statins', 'NSAIDs'],
    'gout': ['diuretics', 'aspirin low dose'],
    'heart_failure': ['NSAIDs', 'negative inotropes', 'salt substitutes']
  };

  /**
   * Check drug interactions for a list of medicines
   * @param {Array} medicines - Array of medicine names to check
   * @param {Array} patientMedications - Current medications patient is taking
   * @returns {Object} - Interaction warnings and alerts
   */
  static async checkDrugInteractions(medicines, patientMedications = []) {
    const interactions = {
      severe: [],
      moderate: [],
      mild: [],
      warnings: []
    };

    const allMedicines = [...medicines, ...patientMedications];

    // Check medicine-to-medicine interactions
    for (let i = 0; i < medicines.length; i++) {
      const med1 = medicines[i].toLowerCase();
      const medData = this.DRUG_INTERACTIONS[med1];

      if (medData) {
        for (let j = i + 1; j < allMedicines.length; j++) {
          const med2 = allMedicines[j].toLowerCase();

          // Check if contraindicated
          if (medData.contraindicated.some(c => med2.includes(c))) {
            interactions.severe.push({
              drug1: medicines[i],
              drug2: allMedicines[j],
              interaction: 'CONTRAINDICATED - DO NOT USE TOGETHER',
              recommendation: `Avoid ${medicines[i]} with ${allMedicines[j]}. Consider alternative.`,
              level: 'SEVERE'
            });
          }

          // Check if caution needed
          if (medData.caution.some(c => med2.includes(c))) {
            interactions.moderate.push({
              drug1: medicines[i],
              drug2: allMedicines[j],
              interaction: 'Interaction possible - use with caution',
              recommendation: `Monitor patient closely when using ${medicines[i]} with ${allMedicines[j]}.`,
              level: 'MODERATE'
            });
          }
        }
      }
    }

    return interactions;
  }

  /**
   * Check patient-specific contraindications
   * @param {Array} medicines - Medicines being prescribed
   * @param {Array} patientConditions - Patient's medical conditions
   * @returns {Array} - Contraindication warnings
   */
  static async checkPatientContraindications(medicines, patientConditions = []) {
    const contraindications = [];

    for (const condition of patientConditions) {
      const conditionKey = condition.toLowerCase().replace(/\s+/g, '_');
      const contraindicatedDrugs = this.PATIENT_CONTRAINDICATIONS[conditionKey];

      if (contraindicatedDrugs) {
        for (const medicine of medicines) {
          if (contraindicatedDrugs.some(drug => medicine.toLowerCase().includes(drug.toLowerCase()))) {
            contraindications.push({
              medicine: medicine,
              condition: condition,
              warning: `${medicine} may be contraindicated in patients with ${condition}`,
              recommendation: `Review carefully. Consider alternative if available.`,
              severity: 'HIGH'
            });
          }
        }
      }
    }

    return contraindications;
  }

  /**
   * Check dosage appropriateness
   * @param {Object} dosageInfo - { dosage, frequency, age, weight, conditions }
   * @returns {Object} - Dosage recommendations
   */
  static async checkDosage(dosageInfo) {
    const { dosage, frequency, age, weight, conditions = [] } = dosageInfo;
    const warnings = [];

    // Check for elderly patients (65+)
    if (age >= 65) {
      warnings.push({
        type: 'AGE_RELATED',
        message: 'Patient is elderly (65+). Review dosage for appropriateness.',
        recommendation: 'May need dose adjustment. Refer to elderly dosing guidelines.'
      });
    }

    // Check for pediatric patients
    if (age < 18) {
      warnings.push({
        type: 'PEDIATRIC',
        message: 'Pediatric patient. Ensure dosage is weight-appropriate.',
        recommendation: `Weight: ${weight}kg. Verify dose calculation.`
      });
    }

    // Check for renal/hepatic impairment
    if (conditions.includes('renal_disease') || conditions.includes('kidney_disease')) {
      warnings.push({
        type: 'RENAL_IMPAIRMENT',
        message: 'Patient has renal disease. Dosage may need adjustment.',
        recommendation: 'Review renal dosing guidelines.'
      });
    }

    if (conditions.includes('liver_disease') || conditions.includes('hepatic_impairment')) {
      warnings.push({
        type: 'HEPATIC_IMPAIRMENT',
        message: 'Patient has liver disease. Dosage may need adjustment.',
        recommendation: 'Review hepatic dosing guidelines.'
      });
    }

    return {
      dosage,
      frequency,
      warnings,
      status: warnings.length > 0 ? 'REVIEW_RECOMMENDED' : 'OK'
    };
  }

  /**
   * Generate comprehensive medication safety report
   */
  static async generateSafetyReport(prescriptionData) {
    const { medicines, patientAge, patientWeight, patientConditions, currentMedications } = prescriptionData;

    const medicineNames = medicines.map(m => m.medicine_name);
    const currentMedNames = currentMedications.map(m => m.medicine_name || m);

    const report = {
      timestamp: new Date().toISOString(),
      medicinesChecked: medicineNames,
      checks: {
        drugInteractions: await this.checkDrugInteractions(medicineNames, currentMedNames),
        patientContraindications: await this.checkPatientContraindications(medicineNames, patientConditions),
        dosageReview: medicines.map(med => this.checkDosage({
          dosage: med.dosage,
          frequency: med.frequency,
          age: patientAge,
          weight: patientWeight,
          conditions: patientConditions
        }))
      },
      overallSafety: 'REQUIRES_REVIEW',
      recommendedActions: []
    };

    // Determine overall safety status
    const severeCount = report.checks.drugInteractions.severe.length;
    const moderateCount = report.checks.drugInteractions.moderate.length;
    const contraCount = report.checks.patientContraindications.length;

    if (severeCount > 0) {
      report.overallSafety = 'HIGH_RISK';
      report.recommendedActions.push('DO NOT DISPENSE - Severe drug interactions detected');
    } else if (moderateCount > 0 || contraCount > 0) {
      report.overallSafety = 'CAUTION_REQUIRED';
      report.recommendedActions.push('Review prescription with doctor before dispensing');
    } else {
      report.overallSafety = 'SAFE';
      report.recommendedActions.push('Safe to dispense');
    }

    return report;
  }
}

module.exports = DrugInteractionService;
