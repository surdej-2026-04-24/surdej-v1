import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const FROM = process.env.SMTP_FROM ?? 'Asger Steenholdt <asger@asgersteenholdt.com>';

interface MagicLinkOptions {
    to: string;
    name: string;
    locale: 'da' | 'en';
    purpose: string;
    url: string;
    sessionNumber?: number;
}

export async function sendMagicLink(opts: MagicLinkOptions): Promise<void> {
    const { to, name, locale, purpose, url, sessionNumber } = opts;

    const subject =
        locale === 'da'
            ? purpose === 'assessment'
                ? `Din forberedelse til session ${sessionNumber} — Mental Klarhed`
                : 'Velkommen til dit Mental Klarhed-forløb'
            : purpose === 'assessment'
                ? `Your preparation for session ${sessionNumber} — Mental Klarhed`
                : 'Welcome to your Mental Klarhed programme';

    const body =
        locale === 'da'
            ? buildDanish(name, purpose, url, sessionNumber)
            : buildEnglish(name, purpose, url, sessionNumber);

    await transporter.sendMail({ from: FROM, to, subject, html: body });
}

function buildDanish(name: string, purpose: string, url: string, session?: number): string {
    const greeting = `Hej ${name},`;
    const intro =
        purpose === 'assessment'
            ? `En uge før din næste session (session ${session}) er det tid til et hurtigt Livshjulet-eftersyn.`
            : `Jeg glæder mig til at arbejde sammen med dig. Klik på knappen nedenfor for at komme i gang.`;

    return `
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <h2 style="font-size: 22px; margin-bottom: 8px;">Mental Klarhed</h2>
  <p style="color: #888; font-size: 13px; margin-top: 0;">Asger Johannes Steenholdt · Psykoterapeut MPF</p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
  <p>${greeting}</p>
  <p>${intro}</p>
  <p style="margin: 30px 0;">
    <a href="${url}" style="
      background: #1a1a1a;
      color: #fff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 4px;
      font-size: 15px;
    ">Åbn mit forløb</a>
  </p>
  <p style="color: #888; font-size: 12px;">
    Linket er gyldigt i 7 dage og kan kun bruges én gang. Kan du ikke klikke? Kopiér denne adresse: ${url}
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 30px;">
    Dine data behandles fortroligt i henhold til GDPR. Du kan til enhver tid anmode om indsigt eller sletning.<br />
    <a href="https://www.asgersteenholdt.com/privatlivspolitik/" style="color: #888;">Privatlivspolitik</a>
  </p>
</div>`;
}

function buildEnglish(name: string, purpose: string, url: string, session?: number): string {
    const greeting = `Hi ${name},`;
    const intro =
        purpose === 'assessment'
            ? `One week before your next session (session ${session}), it's time for a quick Life Wheel check-in.`
            : `I look forward to working with you. Click the button below to get started.`;

    return `
<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <h2 style="font-size: 22px; margin-bottom: 8px;">Mental Klarhed</h2>
  <p style="color: #888; font-size: 13px; margin-top: 0;">Asger Johannes Steenholdt · Psychotherapist MPF</p>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
  <p>${greeting}</p>
  <p>${intro}</p>
  <p style="margin: 30px 0;">
    <a href="${url}" style="
      background: #1a1a1a;
      color: #fff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 4px;
      font-size: 15px;
    ">Open my programme</a>
  </p>
  <p style="color: #888; font-size: 12px;">
    The link is valid for 7 days and can only be used once. Can't click? Copy this address: ${url}
  </p>
  <p style="color: #888; font-size: 12px; margin-top: 30px;">
    Your data is handled confidentially in accordance with GDPR. You may request access or deletion at any time.<br />
    <a href="https://www.asgersteenholdt.com/privatlivspolitik/" style="color: #888;">Privacy Policy</a>
  </p>
</div>`;
}
