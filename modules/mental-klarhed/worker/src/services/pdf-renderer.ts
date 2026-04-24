import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PDF_OUTPUT_DIR = process.env.PDF_OUTPUT_DIR ?? '/tmp/mental-klarhed-pdfs';

export async function renderPdf(markdownContent: string, sessionId: string): Promise<string> {
    mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
    const filename = `session-${sessionId}.pdf`;
    const outputPath = join(PDF_OUTPUT_DIR, filename);

    await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 60 });
        const stream = createWriteStream(outputPath);

        doc.pipe(stream);
        stream.on('finish', resolve);
        stream.on('error', reject);

        // ─── Header ───────────────────────────────────────────
        doc
            .font('Helvetica-Bold')
            .fontSize(18)
            .fillColor('#1a1a1a')
            .text('Mental Klarhed', { align: 'left' });

        doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#666666')
            .text('Forberedelse til din næste session', { align: 'left' });

        doc.moveDown(1.5);
        doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).strokeColor('#e0e0e0').stroke();
        doc.moveDown(1);

        // ─── Body — simple markdown → PDF ─────────────────────
        const lines = markdownContent.split('\n');
        for (const line of lines) {
            if (line.startsWith('# ')) {
                doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a1a1a').text(line.slice(2));
                doc.moveDown(0.5);
            } else if (line.startsWith('## ')) {
                doc.font('Helvetica-Bold').fontSize(13).fillColor('#2c2c2c').text(line.slice(3));
                doc.moveDown(0.4);
            } else if (line.startsWith('### ')) {
                doc.font('Helvetica-Bold').fontSize(11).fillColor('#444').text(line.slice(4));
                doc.moveDown(0.3);
            } else if (line.startsWith('- ')) {
                doc.font('Helvetica').fontSize(11).fillColor('#1a1a1a')
                    .text(`• ${line.slice(2)}`, { indent: 15 });
            } else if (line.trim() === '') {
                doc.moveDown(0.5);
            } else {
                doc.font('Helvetica').fontSize(11).fillColor('#1a1a1a').text(line);
            }
        }

        // ─── Footer ───────────────────────────────────────────
        doc.fontSize(9).fillColor('#aaa')
            .text(
                'Asger Johannes Steenholdt · Psykoterapeut MPF · asger@asgersteenholdt.com',
                60,
                doc.page.height - 40,
                { align: 'center', width: doc.page.width - 120 }
            );

        doc.end();
    });

    return outputPath;
}
