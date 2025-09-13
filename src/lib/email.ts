import emailjs from '@emailjs/browser';

interface ContactEmailProps {
  name: string;
  email: string;
  message: string;
}

// Updated to match the interface in supabase.ts
export interface AnalysisEmailProps {
  userName: string;
  contractTitle: string;
  riskLevel: 'low' | 'medium' | 'high';
  issuesCount: number;
}

export async function sendContactEmail(data: ContactEmailProps) {
  try {
    console.log("📨 Sending email with EmailJS...");
    
    const response = await emailjs.send(
      'service_ile56zc',
      'template_8y2z9dp',
      {
        from_name: data.name,
        to_name: "Thabhelo",
        from_email: data.email,
        to_email: "thabhelo.duve+redflagged@gmail.com",
        message: data.message,
      },
      '_JDd2_-oFPAXuoAI5'
    );

    console.log("Email sent successfully!", response);
    return response;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
}

export async function sendAnalysisEmail(to: string, props: AnalysisEmailProps) {
  try {
    console.log("📨 Sending analysis email with EmailJS...");
    
    // Updated to use issuesCount instead of issues array
    const response = await emailjs.send(
      'service_ile56zc',
      'template_8y2z9dp',
      {
        from_name: "REDFLAGGED Analysis",
        to_name: props.userName,
        from_email: "analysis@redflagged.ai",
        to_email: to,
        message: `Contract Analysis Results for "${props.contractTitle}"\n\nRisk Level: ${props.riskLevel}\n\nIssues Found: ${props.issuesCount}`,
      },
      '_JDd2_-oFPAXuoAI5'
    );

    console.log("Analysis email sent successfully!", response);
    return response;
  } catch (error) {
    console.error("❌ Error sending analysis email:", error);
    throw error;
  }
}