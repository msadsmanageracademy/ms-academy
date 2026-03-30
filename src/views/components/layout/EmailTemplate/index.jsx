import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function EmailTemplate({ name, email, subject, message, logoUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Nuevo mensaje de contacto: {subject}</Preview>
      <Body style={styles.body}>
        <Section style={styles.header}>
          <Img src={logoUrl} alt="MS Academy" height="36" />
        </Section>

        <Container style={styles.container}>
          <Heading style={styles.heading}>Nuevo mensaje de contacto</Heading>

          <Hr style={styles.hr} />

          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.value}>{name}</Text>

          <Text style={styles.label}>Email</Text>
          <Link href={`mailto:${email}`} style={styles.link}>
            {email}
          </Link>

          <Text style={styles.label}>Asunto</Text>
          <Text style={styles.value}>{subject}</Text>

          <Hr style={styles.hr} />

          <Section style={styles.messageBox}>
            <Text style={styles.messageText}>{message}</Text>
          </Section>

          <Text style={styles.footer}>
            Respondé directamente a este email para contactar a {name}.
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
    marginBottom: "16px",
    marginTop: "0",
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
  link: {
    color: "#ff9f1c",
    fontSize: "15px",
  },
  messageBox: {
    backgroundColor: "#f9f9f9",
    borderLeft: "3px solid #ff9f1c",
    borderRadius: "4px",
    margin: "16px 0",
    padding: "16px 20px",
  },
  messageText: {
    color: "#333",
    fontSize: "15px",
    lineHeight: "1.65",
    margin: "0",
    whiteSpace: "pre-wrap",
  },
  footer: {
    color: "#aaa",
    fontSize: "12px",
    marginTop: "24px",
  },
};
