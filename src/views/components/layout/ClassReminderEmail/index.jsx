import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function ClassReminderEmail({
  className,
  description,
  startDate,
  duration,
  googleMeetLink,
  logoUrl,
}) {
  return (
    <Html>
      <Head />
      <Preview>Recordatorio de clase: {className}</Preview>
      <Body style={styles.body}>
        <Section style={styles.header}>
          <Img src={logoUrl} alt="MS Academy" height="36" />
        </Section>

        <Container style={styles.container}>
          <Heading style={styles.heading}>Recordatorio de Clase</Heading>
          <Text style={styles.intro}>
            Te recordamos que tenés una clase programada. Aquí están los
            detalles:
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.label}>Clase</Text>
          <Text style={styles.value}>{className}</Text>

          {description && (
            <>
              <Text style={styles.label}>Descripción</Text>
              <Text style={styles.value}>{description}</Text>
            </>
          )}

          <Text style={styles.label}>Fecha y hora</Text>
          <Text style={styles.value}>{startDate}</Text>

          <Text style={styles.label}>Duración</Text>
          <Text style={styles.value}>{duration} minutos</Text>

          <Hr style={styles.hr} />

          {googleMeetLink && (
            <Section style={styles.linksSection}>
              {googleMeetLink && (
                <Button href={googleMeetLink} style={styles.meetButton}>
                  Unirse con Google Meet
                </Button>
              )}
            </Section>
          )}

          <Text style={styles.footer}>
            Si tenés alguna consulta, respondé directamente a este email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#f4f4f4",
    fontFamily: "sans-serif",
  },
  header: {
    backgroundColor: "#120d0d",
    borderBottom: "3px solid #ff9f1c",
    padding: "24px 32px",
  },
  container: {
    backgroundColor: "#ffffff",
    margin: "0 auto",
    maxWidth: "600px",
    padding: "32px",
  },
  heading: {
    color: "#120d0d",
    fontSize: "20px",
    marginBottom: "8px",
    marginTop: "0",
  },
  intro: {
    color: "#555",
    fontSize: "15px",
    lineHeight: "1.5",
    margin: "0 0 16px",
  },
  hr: {
    border: "none",
    borderTop: "1px solid #e5e5e5",
    margin: "16px 0",
  },
  label: {
    color: "#888",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.08em",
    margin: "12px 0 2px",
    textTransform: "uppercase",
  },
  value: {
    color: "#1a1a1a",
    fontSize: "15px",
    margin: "0",
  },
  linksSection: {
    margin: "24px 0",
    textAlign: "center",
  },
  meetButton: {
    backgroundColor: "#ff5c5c",
    borderRadius: "6px",
    color: "#fff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "600",
    padding: "12px 24px",
    textDecoration: "none",
  },
  footer: {
    color: "#aaa",
    fontSize: "12px",
    marginTop: "24px",
  },
};
