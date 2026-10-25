/** Sample inbound messages for the integration simulator and documentation. Safe to import in the browser. */
const ts = (d = new Date()) => d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
const rnd = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, '0');

export function newPlacer() { return `HIS${rnd(7)}`; }

export function sampleOrm(o: { placer?: string; mrn?: string; procedure?: string; procedureName?: string; priority?: 'S' | 'A' | 'R'; control?: 'NW' | 'CA' | 'XO' } = {}) {
  const placer = o.placer || newPlacer();
  const mrn = o.mrn || `H${rnd(6)}`;
  const control = o.control || 'NW';
  return [
    `MSH|^~\\&|EPIC|CITYGEN|RADIANT|RADIOLOGY|${ts()}||ORM^O01|MSG${rnd(9)}|P|2.5.1`,
    `PID|1||${mrn}^^^CITYGEN^MR||OKAFOR^AMARA^N||19780412|F|||14 Harbour Road^^Springfield^^40021||555-0142`,
    `PV1|1|E|ED^BAY4^01|||||D1123^PATEL^NIKHIL`,
    `ORC|${control}|${placer}|||||^^^^^${o.priority || 'S'}||${ts()}|||D1123^PATEL^NIKHIL`,
    `OBR|1|${placer}||${o.procedure || 'CT-CTPA'}^${o.procedureName || 'CT Pulmonary angiography'}^L|${o.priority || 'S'}|${ts()}|||||||Pleuritic chest pain, tachycardia, D-dimer 1.9|||D1123^PATEL^NIKHIL`,
  ].join('\r');
}

export function sampleOru(o: { accession: string; placer?: string }) {
  const obr: string[] = Array(33).fill('');
  obr[0] = 'OBR'; obr[1] = '1'; obr[2] = o.placer || ''; obr[3] = o.accession; obr[4] = '^Outside read';
  obr[7] = ts(); obr[18] = o.accession; obr[22] = ts(); obr[25] = 'F'; obr[32] = '^CHEN^WEI';
  return [
    `MSH|^~\\&|TELERAD|NIGHTHAWK|RADIANT|RADIOLOGY|${ts()}||ORU^R01|MSG${rnd(9)}|P|2.5.1`,
    `PID|1||UNKNOWN`,
    obr.join('|'),
    `OBX|1|TX|FINDINGS^Findings||The study has been reviewed by the teleradiology service.\\.br\\No acute abnormality is identified.||||||F`,
    `OBX|2|TX|IMP^Impression||No acute abnormality.||||||F`,
  ].join('\r');
}

export function sampleAdt(mrn = `H${rnd(6)}`) {
  return [
    `MSH|^~\\&|EPIC|CITYGEN|RADIANT|RADIOLOGY|${ts()}||ADT^A08|MSG${rnd(9)}|P|2.5.1`,
    `PID|1||${mrn}^^^CITYGEN^MR||NGUYEN^THANH||19650930|M|||22 Mill Lane^^Springfield^^40023||555-0199`,
  ].join('\r');
}

export function sampleInvalidOrm() {
  return sampleOrm({ procedure: 'CT-TOE', procedureName: 'CT big toe with glitter' });
}

export function sampleServiceRequest(o: { code?: string; priority?: string } = {}) {
  return {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    priority: o.priority || 'urgent',
    identifier: [{ system: 'urn:emr:order', value: `EMR-${rnd(6)}` }],
    code: { coding: [{ system: 'urn:ris:procedure', code: o.code || 'MR-BRAIN', display: 'MRI Brain without contrast' }] },
    contained: [{
      resourceType: 'Patient', id: 'p1', identifier: [{ system: 'urn:emr:mrn', value: `E${rnd(6)}` }],
      name: [{ family: 'Silva', given: ['Marta'] }], gender: 'female', birthDate: '1990-06-21',
    }],
    subject: { reference: '#p1' },
    requester: { display: 'Northside Clinic EMR' },
    reasonCode: [{ text: 'New onset headaches with visual aura' }],
  };
}
