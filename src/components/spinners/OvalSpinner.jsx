import { Oval } from "react-loader-spinner";

export const OvalSpinner = () => {
  return (
    <Oval
      visible={true}
      height="80"
      width="80"
      color="#3b7b3a"
      ariaLabel="oval-loading"
      wrapperStyle={{}}
      wrapperClass=""
    />
  );
};

export default OvalSpinner;
