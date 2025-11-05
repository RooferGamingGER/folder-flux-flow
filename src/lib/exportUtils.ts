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
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip
} from 'docx';
import logoImage from '@/assets/nobis-logo.png';

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

// Hilfsfunktion: Word-Dokument als Blob erstellen (ohne Download)
async function createProjectWordDocument(
  project: any,
  details: any,
  notes: any[],
  contacts: any[],
  messages: any[]
): Promise<Blob> {
  // Logo laden
  const logoResponse = await fetch(logoImage);
  const logoBlob = await logoResponse.blob();
  const logoBase64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(logoBlob);
  });

  // Header mit Logo erstellen
  const header = new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: Uint8Array.from(atob(logoBase64), c => c.charCodeAt(0)),
            transformation: {
              width: 550,
              height: 110,
            },
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    ],
  });

  // Überschrift
  const titleParagraph = new Paragraph({
    text: "Projektdokumentation",
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 300 },
  });

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
          width: { size: 35, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
        }),
        new TableCell({
          children: [new Paragraph(value)],
          width: { size: 65, type: WidthType.PERCENTAGE },
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

  const firstPageContent: (Paragraph | Table)[] = [
    titleParagraph,
    detailsTable,
  ];

  // Notizen
  if (notes && notes.length > 0) {
    firstPageContent.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Notizen",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 400, after: 200 },
      })
    );
    
    notes.forEach(note => {
      firstPageContent.push(
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
    firstPageContent.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Kontakte",
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 400, after: 200 },
      })
    );
    
    contacts.forEach(contact => {
      firstPageContent.push(
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

  // Chat-Verlauf - Neue Seite mit 2 Spalten
  const chatPageContent: (Paragraph | Table)[] = [];
  
  chatPageContent.push(
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

  // Chat-Messages in 2-Spalten-Tabelle
  if (messages && messages.length > 0) {
    const messageRows: TableRow[] = [];
    let currentRow: any[] = [];

    for (const msg of messages) {
      const timestamp = new Date(msg.timestamp).toLocaleString('de-DE');
      const sender = msg.profile 
        ? `${msg.profile.first_name} ${msg.profile.last_name}`
        : msg.sender || 'Unbekannt';

      const messageCellContent: (Paragraph | Table)[] = [];

      // Header
      messageCellContent.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${sender} - ${timestamp}`,
              bold: true,
              color: '666666',
              size: 18,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      // Content
      if (msg.type === 'text' && msg.content?.text) {
        messageCellContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: msg.content.text,
                size: 20,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
      
      if (msg.type === 'image' && msg.content?.url) {
        try {
          const imageBase64 = await imageUrlToBase64(msg.content.url);
          if (imageBase64) {
            const imgData = imageBase64.split(',')[1];
            messageCellContent.push(
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'png',
                    data: Uint8Array.from(atob(imgData), c => c.charCodeAt(0)),
                    transformation: {
                      width: 220,
                      height: 165,
                    },
                  }),
                ],
                spacing: { after: 100 },
              })
            );
          }
        } catch (error) {
          console.error('Error loading image:', error);
          messageCellContent.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: '[Bild konnte nicht geladen werden]',
                  italics: true,
                  color: '999999',
                }),
              ],
            })
          );
        }
      }

      if (msg.type === 'audio') {
        messageCellContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '🎵 Sprachnachricht',
                italics: true,
              }),
            ],
          })
        );
      }

      if (msg.type === 'video') {
        messageCellContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '🎥 Video',
                italics: true,
              }),
            ],
          })
        );
      }

      if (msg.type === 'file') {
        messageCellContent.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `📄 ${msg.content?.name || 'Datei'}`,
                italics: true,
              }),
            ],
          })
        );
      }

      // Trennlinie
      messageCellContent.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "──────────────",
              color: 'CCCCCC',
            }),
          ],
          spacing: { before: 100 },
        })
      );

      // Zu aktueller Zeile hinzufügen
      currentRow.push(messageCellContent);

      // Wenn 2 Spalten voll, neue Zeile erstellen
      if (currentRow.length === 2) {
        messageRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: currentRow[0],
                width: { size: 48, type: WidthType.PERCENTAGE },
                margins: {
                  top: convertInchesToTwip(0.1),
                  bottom: convertInchesToTwip(0.1),
                  left: convertInchesToTwip(0.1),
                  right: convertInchesToTwip(0.1),
                },
                verticalAlign: 'top' as any,
              }),
              new TableCell({
                children: currentRow[1],
                width: { size: 48, type: WidthType.PERCENTAGE },
                margins: {
                  top: convertInchesToTwip(0.1),
                  bottom: convertInchesToTwip(0.1),
                  left: convertInchesToTwip(0.1),
                  right: convertInchesToTwip(0.1),
                },
                verticalAlign: 'top' as any,
              }),
            ],
          })
        );
        currentRow = [];
      }
    }

    // Letzte Zeile (falls ungerade Anzahl)
    if (currentRow.length === 1) {
      messageRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: currentRow[0],
              width: { size: 48, type: WidthType.PERCENTAGE },
              margins: {
                top: convertInchesToTwip(0.1),
                bottom: convertInchesToTwip(0.1),
                left: convertInchesToTwip(0.1),
                right: convertInchesToTwip(0.1),
              },
              verticalAlign: 'top' as any,
            }),
            new TableCell({
              children: [new Paragraph({ text: '' })],
              width: { size: 48, type: WidthType.PERCENTAGE },
            }),
          ],
        })
      );
    }

    if (messageRows.length > 0) {
      chatPageContent.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: messageRows,
          columnWidths: [4800, 4800],
        })
      );
    }
  } else {
    chatPageContent.push(
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
              top: 1800,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: header,
        },
        children: [
          ...firstPageContent,
          ...chatPageContent,
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

// Export-Funktion für Word (nutzt die Hilfsfunktion)
export async function exportProjectToWord(
  project: any,
  details: any,
  notes: any[],
  contacts: any[],
  messages: any[]
) {
  const blob = await createProjectWordDocument(project, details, notes, contacts, messages);
  
  // Download starten
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.title.replace(/[^a-zA-Z0-9]/g, '_')}_Dokumentation.docx`;
  link.click();
  window.URL.revokeObjectURL(url);
}

// ZIP-Export Funktion
export async function exportProjectAsZip(
  project: any,
  details: any,
  notes: any[],
  contacts: any[],
  messages: any[],
  files: any[],
  getFileUrl: (file: any) => string,
  selectedFolders?: string[],
  onProgress?: (current: number, total: number, fileName: string) => void
) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  
  const projectName = project.title.replace(/[^a-z0-9]/gi, '_');
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `${projectName}_Export_${timestamp}`;
  
  // 1. Word-Dokument erstellen und zur ZIP hinzufügen
  onProgress?.(0, 1, 'Projektdokumentation.docx');
  const docBlob = await createProjectWordDocument(project, details, notes, contacts, messages);
  zip.file(`${folderName}/Projektdokumentation.docx`, docBlob);
  
  // 2. Dateien filtern und nach Ordner gruppieren
  const filteredFiles = selectedFolders && selectedFolders.length > 0
    ? files.filter(file => selectedFolders.includes(file.folder || 'Sonstige'))
    : files;
  
  const filesByFolder = filteredFiles.reduce((acc, file) => {
    const folder = file.folder || 'Sonstige';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, any[]>);
  
  // 3. Alle Dateien laden und zur ZIP hinzufügen
  const totalFiles = filteredFiles.length;
  let currentFileIndex = 0;
  
  const entries = Object.entries(filesByFolder) as [string, any[]][];
  for (const [folder, folderFiles] of entries) {
    for (const file of folderFiles) {
      currentFileIndex++;
      onProgress?.(currentFileIndex, totalFiles, file.name);
      
      try {
        const url = getFileUrl(file);
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(`${folderName}/${folder}/${file.name}`, blob);
      } catch (error) {
        console.error(`Fehler beim Laden von ${file.name}:`, error);
      }
    }
  }
  
  // 4. ZIP generieren und Download starten
  onProgress?.(totalFiles, totalFiles, 'ZIP wird erstellt...');
  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  // Download starten
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `${folderName}.zip`;
  link.click();
  URL.revokeObjectURL(link.href);
}
