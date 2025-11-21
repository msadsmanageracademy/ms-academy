import { Oval } from "react-loader-spinner";

export const OvalSpinner = ({ size }) => {
  return (
    <Oval
      visible={true}
      height={size || "80"}
      width={size || "80"}
      color="#3b7b3a"
      ariaLabel="oval-loading"
      wrapperStyle={{}}
      wrapperClass=""
    />
  );
};

export default OvalSpinner;
