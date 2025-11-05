import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  ImageRun, 
  AlignmentType, 
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from 'docx';

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

// Hilfsfunktion: Bild-URL zu Base64 konvertieren
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting image:', error);
    return '';
  }
}

export async function exportProjectToWord(
  project: any,
  details: any,
  notes: any[],
  contacts: any[],
  messages: any[]
) {
  // Logo laden
  const logoUrl = new URL('/src/assets/nobis-logo.jpg', import.meta.url).href;
  const logoBase64 = await imageUrlToBase64(logoUrl);
  const logoData = logoBase64.split(',')[1];

  const paragraphs: Paragraph[] = [];

  // Logo einfügen
  if (logoData) {
    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: 'jpg',
            data: Uint8Array.from(atob(logoData), c => c.charCodeAt(0)),
            transformation: {
              width: 500,
              height: 100,
            },
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
  }

  // Überschrift
  paragraphs.push(
    new Paragraph({
      text: "Projektdokumentation",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 400 },
    })
  );

  // Projektname
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: project.title || 'Unbenanntes Projekt',
          bold: true,
          size: 32,
        }),
      ],
      spacing: { after: 200 },
    })
  );

  // Projekt-ID
  if (details?.auftragsnummer) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Projekt-ID: ',
            bold: true,
          }),
          new TextRun({
            text: details.auftragsnummer,
          }),
        ],
        spacing: { after: 300 },
      })
    );
  }

  // Projektdetails Tabelle
  const detailsRows = [
    ['Status:', details?.projektstatus || '-'],
    ['Ansprechpartner:', details?.ansprechpartner || '-'],
    ['Straße:', details?.strasse || '-'],
    ['PLZ / Stadt:', `${details?.plz || '-'} ${details?.stadt || '-'}`],
    ['Land:', details?.land || '-'],
    ['Startdatum:', details?.startdatum ? new Date(details.startdatum).toLocaleDateString('de-DE') : '-'],
    ['Enddatum:', details?.enddatum ? new Date(details.enddatum).toLocaleDateString('de-DE') : '-'],
    ['Erstellt am:', new Date(project.created_at).toLocaleDateString('de-DE')],
  ];

  const detailsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: detailsRows.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ 
            children: [new TextRun({ text: label, bold: true })],
          })],
          width: { size: 30, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
        }),
        new TableCell({
          children: [new Paragraph(value)],
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
        }),
      ],
    })),
  });

  paragraphs.push(
    new Paragraph({
      text: "",
      spacing: { before: 200, after: 200 },
    })
  );

  // Notizen
  if (notes && notes.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Notizen",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 300, after: 200 },
      })
    );
    
    notes.forEach(note => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `• ${note.text || ''}`,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    });
  }

  // Kontakte
  if (contacts && contacts.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Kontakte",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 300, after: 200 },
      })
    );
    
    contacts.forEach(contact => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${contact.name || '-'} | `,
              bold: true,
            }),
            new TextRun({
              text: `📧 ${contact.email || '-'} | 📞 ${contact.phone || '-'}`,
            }),
          ],
          spacing: { after: 100 },
        })
      );
    });
  }

  // Chat-Verlauf - Neue Seite
  paragraphs.push(
    new Paragraph({
      text: "",
      pageBreakBefore: true,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Chat-Verlauf",
          bold: true,
          size: 32,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    })
  );

  // Messages
  if (messages && messages.length > 0) {
    for (const msg of messages) {
      const timestamp = new Date(msg.timestamp).toLocaleString('de-DE');
      const sender = msg.profile 
        ? `${msg.profile.first_name} ${msg.profile.last_name}`
        : msg.sender || 'Unbekannt';

      // Nachricht-Header
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${sender} - ${timestamp}`,
              bold: true,
              color: '666666',
              size: 20,
            }),
          ],
          spacing: { before: 200, after: 100 },
        })
      );

      // Text-Nachricht
      if (msg.type === 'text' && msg.content?.text) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: msg.content.text,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
      
      // Bilder
      if (msg.type === 'image' && msg.content?.url) {
        try {
          const imageBase64 = await imageUrlToBase64(msg.content.url);
          if (imageBase64) {
            const imgData = imageBase64.split(',')[1];
            const imageType = msg.content.url.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
            paragraphs.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: imageType,
                    data: Uint8Array.from(atob(imgData), c => c.charCodeAt(0)),
                    transformation: {
                      width: 400,
                      height: 300,
                    },
                  }),
                ],
                spacing: { after: 200 },
              })
            );
          }
        } catch (error) {
          console.error('Error loading image:', error);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '[Bild konnte nicht geladen werden]',
                  italics: true,
                  color: '999999',
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      }

      // Audio
      if (msg.type === 'audio' && msg.content?.url) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '🎵 Sprachnachricht',
                italics: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Trennlinie
      paragraphs.push(
        new Paragraph({
          text: "─────────────────────────────────────",
          alignment: AlignmentType.LEFT,
          spacing: { after: 100 },
        })
      );
    }
  } else {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Keine Nachrichten vorhanden',
            italics: true,
            color: '999999',
          }),
        ],
      })
    );
  }

  // Dokument erstellen
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          detailsTable,
          ...paragraphs,
        ],
      },
    ],
  });

  // Download
  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_Dokumentation.docx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
