import { Oval } from "react-loader-spinner";

export const OvalSpinner = ({ size }) => {
  return (
    <Oval
      visible
      ariaLabel="oval-loading"
      color="var(--color-3)"
      height={size || "80"}
      secondaryColor="var(--danger)"
      width={size || "80"}
      wrapperStyle={{}}
      wrapperClass=""
    />
  );
};

export default OvalSpinner;
