import axios from "axios";
import { IUser } from "../../types";

class LLMService {
    sendUserQuery = async (user: IUser, message: string): Promise<string> => {
        return "true";
    };

    sendNameQuery = async (
        freeText: string,
    ): Promise<{ detected_name: string; has_name: string }> => {
        const llmRes = await axios.get(
            `http://192.168.1.20:8001/chat/username?response=${encodeURIComponent(freeText || "")}`,
        );
        console.log(` LLM response: ${JSON.stringify(llmRes.data)}`);
        return llmRes.data;
    };
}

export default LLMService;
