import { getProcessEnv } from "env/process-env";
import { Resend } from "resend";

const resend = new Resend(getProcessEnv("RESEND_API_KEY"));

export default resend;
