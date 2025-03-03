"use client";

import { createContext, useContext, useState } from "react";

const ExperimentalDesignContext = createContext();

export const useExperimentalDesign = () =>
  useContext(ExperimentalDesignContext);

export const ExperimentalDesignProvider = ({ children }) => {
  const [experimentalDesign, setExperimentalDesign] = useState([]);

  const updateExperimentalDesign = ({ step, key, value }) => {
    const isStepInExperimentalDesign = experimentalDesign.filter(
      (element) => element.step === step
    );

    if (!isStepInExperimentalDesign.length) {
      console.log("Agrego nuevo");
      setExperimentalDesign([...experimentalDesign, { step, key, value }]);
    } else {
      const updatedExperimentalDesign = experimentalDesign.map((element) => {
        console.log("Modifico");
        if (element.step === step) {
          return { ...element, key, value };
        }
        return element;
      });
      setExperimentalDesign(updatedExperimentalDesign);
    }
  };

  const updateExperimentalDesignWithMultipleEntries = (step, entries) => {
    const currentStep = step;
    const newEntries = entries;

    console.log(currentStep);
    console.log(newEntries);

    const isStepInExperimentalDesign = experimentalDesign.filter(
      (element) => element.step == currentStep
    );

    const formattedEntries = newEntries.map(({ name, value }) => {
      return {
        step: currentStep,
        key: name,
        value,
      };
    });

    if (!isStepInExperimentalDesign.length) {
      console.log("Agrego entradas nuevas");

      setExperimentalDesign([...experimentalDesign, ...formattedEntries]);
    } else {
      console.log("Modifico");
      const updatedExperimentalDesign = experimentalDesign.filter(
        (item) => item.step != step
      );

      setExperimentalDesign([
        ...updatedExperimentalDesign,
        ...formattedEntries,
      ]);
    }
  };

  return (
    <ExperimentalDesignContext.Provider
      value={{
        experimentalDesign,
        setExperimentalDesign,
        updateExperimentalDesign,
        updateExperimentalDesignWithMultipleEntries,
      }}
    >
      {children}
    </ExperimentalDesignContext.Provider>
  );
};
