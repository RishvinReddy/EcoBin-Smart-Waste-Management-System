export const sendEmailAlert = async (
  heading: string,
  greeting: string,
  message: string,
  details: string,
  toEmail?: string
) => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_ogb00uj';
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_3tdnczh';
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '4xIcX3bYHEfvY71Re';

  if (publicKey === 'YOUR_PUBLIC_KEY_HERE') {
    console.warn('[EmailJS] VITE_EMAILJS_PUBLIC_KEY not set. Simulating email send:', { heading, message });
    return false;
  }

  const date = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: true
  });

  const payload = {
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: {
      heading,
      greeting,
      message,
      details,
      date,
      ...(toEmail && { to_email: toEmail })
    }
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`[EmailJS] Successfully sent email: ${heading}`);
      return true;
    } else {
      const text = await response.text();
      console.error(`[EmailJS] Failed to send email. Status: ${response.status}`, text);
      return false;
    }
  } catch (error) {
    console.error('[EmailJS] Exception while sending email:', error);
    return false;
  }
};
