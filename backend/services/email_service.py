import urllib.request
import urllib.error
import json
import os
import datetime

# EmailJS Configuration
EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "service_ogb00uj")
EMAILJS_TEMPLATE_ID = os.getenv("EMAILJS_TEMPLATE_ID", "template_3tdnczh")
EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "4xIcX3bYHEfvY71Re")
EMAILJS_API_URL = "https://api.emailjs.com/api/v1.0/email/send"

def send_email_alert(heading: str, greeting: str, message: str, details: str, to_email: str = None):
    """
    Sends an email using the EmailJS REST API.
    """
    if EMAILJS_PUBLIC_KEY == "YOUR_PUBLIC_KEY_HERE":
        print(f"[EmailJS] Warning: EMAILJS_PUBLIC_KEY is not set. Simulating email: {heading}")
        return False
        
    date_str = datetime.datetime.now().strftime("%b %d, %Y %I:%M %p")
    
    payload = {
        "service_id": EMAILJS_SERVICE_ID,
        "template_id": EMAILJS_TEMPLATE_ID,
        "user_id": EMAILJS_PUBLIC_KEY,
        "template_params": {
            "heading": heading,
            "greeting": greeting,
            "message": message,
            "details": details,
            "date": date_str,
        }
    }
    
    if to_email:
        payload["template_params"]["to_email"] = to_email

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            EMAILJS_API_URL, 
            data=data, 
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10.0) as response:
            if response.status == 200:
                print(f"[EmailJS] Successfully sent email: {heading}")
                return True
            else:
                print(f"[EmailJS] Failed to send email. Status: {response.status}")
                return False
    except urllib.error.URLError as e:
        print(f"[EmailJS] Exception while sending email: {str(e)}")
        return False
