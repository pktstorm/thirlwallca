"""Send transactional emails via AWS SES."""

import logging

import boto3
from botocore.exceptions import ClientError

from app.config import settings

logger = logging.getLogger(__name__)

SENDER = "Thirlwall.ca <noreply@thirlwall.ca>"
FRONTEND_URL = "https://thirlwall.ca"


def _get_ses_client():
    return boto3.client("ses", region_name=settings.aws_region)


def send_onboard_email(email: str, first_name: str, token: str) -> bool:
    """Send the onboarding welcome email with the magic link."""
    link = f"{FRONTEND_URL}/onboard?token={token}"

    subject = "Welcome to Thirlwall.ca"
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #241f19; font-size: 28px; margin: 0;">Thirlwall.ca</h1>
            <p style="color: #8da399; font-size: 14px; margin-top: 4px;">Family History &amp; Heritage</p>
        </div>

        <div style="background: #f4f7f5; border-radius: 12px; padding: 32px; border: 1px solid #c5d6cb;">
            <h2 style="color: #241f19; font-size: 20px; margin-top: 0;">Hi {first_name},</h2>

            <p style="color: #3d5244; font-size: 15px; line-height: 1.6;">
                Your request to join the Thirlwall family site has been approved!
                Click the button below to set up your password and link your account
                to your person on the family tree.
            </p>

            <div style="text-align: center; margin: 32px 0;">
                <a href="{link}"
                   style="display: inline-block; background: #1a5c30; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
                    Set Up Your Account
                </a>
            </div>

            <p style="color: #8da399; font-size: 13px; line-height: 1.5;">
                This link expires in 7 days. If you didn't request access to Thirlwall.ca,
                you can safely ignore this email.
            </p>
        </div>

        <p style="color: #c5d6cb; font-size: 12px; text-align: center; margin-top: 24px;">
            &copy; Thirlwall Family
        </p>
    </div>
    """

    text_body = f"""Hi {first_name},

Your request to join the Thirlwall family site has been approved!

Set up your account here: {link}

This link expires in 7 days.

- Thirlwall.ca"""

    if not settings.cognito_user_pool_id:
        logger.info("Dev mode: would send onboard email to %s with link %s", email, link)
        return True

    try:
        client = _get_ses_client()
        client.send_email(
            Source=SENDER,
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                },
            },
        )
        logger.info("Onboard email sent to %s", email)
        return True
    except ClientError:
        logger.exception("Failed to send onboard email to %s", email)
        return False
