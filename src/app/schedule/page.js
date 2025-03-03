"use client";
import styles from "./styles.module.css";
import { useState } from "react";
import Link from "next/link";

const SchedulePage = () => {
  const [meetingDuration, setMeetingDuration] = useState(30);
  const [availability, setAvailability] = useState({});

  const toggleDay = (day) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { slots: [] },
    }));
  };

  const addSlot = (day) => {
    setAvailability((prev) => {
      const newSlots = [...(prev[day]?.slots || []), { start: "", end: "" }];
      return { ...prev, [day]: { slots: newSlots } };
    });
  };

  const updateSlot = (day, index, field, value) => {
    setAvailability((prev) => {
      const newSlots = prev[day].slots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      );
      return { ...prev, [day]: { slots: newSlots } };
    });
  };

  const removeSlot = (day, index) => {
    setAvailability((prev) => {
      const newSlots = prev[day].slots.filter((_, i) => i !== index);
      return { ...prev, [day]: { slots: newSlots } };
    });
  };

  const handleSubmit = () => {
    console.log({ meetingDuration, availability });
    // Aquí iría la lógica para enviar al backend
  };

  return (
    <div className={styles.container}>
      <h2 style={{ marginBottom: "1rem" }}>Configurar Disponibilidad</h2>
      <label>
        Duración de reunión (minutos):
        <input
          type="number"
          value={meetingDuration}
          onChange={(e) => setMeetingDuration(Number(e.target.value))}
          style={{ marginLeft: "10px", width: "60px" }}
        />
      </label>
      <div>
        <h3 style={{ margin: "1rem 0" }}>Días disponibles</h3>
        {[
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
          "Domingo",
        ].map((day) => (
          <div key={day} style={{ marginBottom: "1rem" }}>
            <label>
              <input
                style={{ marginRight: "0.5rem" }}
                type="checkbox"
                checked={!!availability[day]}
                onChange={() => toggleDay(day)}
              />
              {day}
            </label>
            {availability[day] && (
              <div>
                {availability[day].slots.map((slot, index) => (
                  <div key={index}>
                    <input
                      type="time"
                      value={slot.start}
                      onChange={(e) =>
                        updateSlot(day, index, "start", e.target.value)
                      }
                    />
                    <input
                      type="time"
                      value={slot.end}
                      onChange={(e) =>
                        updateSlot(day, index, "end", e.target.value)
                      }
                    />
                    <button onClick={() => removeSlot(day, index)}>X</button>
                  </div>
                ))}
                <button onClick={() => addSlot(day)}>+ Agregar franja</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <button className={`button-primary`} onClick={handleSubmit}>
        Guardar
      </button>
    </div>
  );
};

export default SchedulePage;
