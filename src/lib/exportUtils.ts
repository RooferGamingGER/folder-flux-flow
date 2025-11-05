import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportProjectsToExcel(projects: any[], allDetails: any[]) {
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Projekte
  const projectData = projects.map(p => {
    const details = allDetails.find(d => d.project_id === p.id);
    return {
      'Projektname': p.title,
      'Auftragsnummer': details?.auftragsnummer || '-',
      'Status': details?.projektstatus || '-',
      'Ansprechpartner': details?.ansprechpartner || '-',
      'Straße': details?.strasse || '-',
      'PLZ': details?.plz || '-',
      'Stadt': details?.stadt || '-',
      'Erstellt': new Date(p.created_at).toLocaleDateString('de-DE'),
      'Archiviert': p.archived ? 'Ja' : 'Nein',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectData), 'Projekte');
  
  XLSX.writeFile(wb, `Projekte_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportProjectToPDF(
  project: any,
  details: any,
  notes: any[],
  contacts: any[],
  messages: any[]
) {
  const doc = new jsPDF();
  
  // Titel
  doc.setFontSize(20);
  doc.text(project.title, 20, 20);
  
  // Projektdetails
  doc.setFontSize(12);
  let yPos = 35;
  doc.text(`Auftragsnummer: ${details?.auftragsnummer || '-'}`, 20, yPos);
  yPos += 7;
  doc.text(`Status: ${details?.projektstatus || '-'}`, 20, yPos);
  yPos += 7;
  doc.text(`Ansprechpartner: ${details?.ansprechpartner || '-'}`, 20, yPos);
  yPos += 7;
  doc.text(`Adresse: ${details?.strasse || '-'}, ${details?.plz || '-'} ${details?.stadt || '-'}`, 20, yPos);
  yPos += 7;
  doc.text(`Erstellt: ${new Date(project.created_at).toLocaleDateString('de-DE')}`, 20, yPos);
  yPos += 15;
  
  // Notizen
  if (notes && notes.length > 0) {
    doc.setFontSize(14);
    doc.text('Notizen:', 20, yPos);
    yPos += 7;
    doc.setFontSize(10);
    notes.forEach(note => {
      const lines = doc.splitTextToSize(note.text || '', 170);
      lines.forEach((line: string) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos);
        yPos += 5;
      });
      yPos += 3;
    });
    yPos += 10;
  }
  
  // Kontakte
  if (contacts && contacts.length > 0) {
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.text('Kontakte:', 20, yPos);
    yPos += 7;
    
    autoTable(doc, {
      startY: yPos,
      head: [['Name', 'Email', 'Telefon']],
      body: contacts.map(c => [c.name || '-', c.email || '-', c.phone || '-']),
      margin: { left: 20 },
      theme: 'grid',
    });
  }
  
  doc.save(`${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_Export.pdf`);
}
