import axios, { AxiosInstance } from "axios";
import { IUser } from "../../types";
import env from "../../config/env";

class LLMService {
    private axiosInstance: AxiosInstance;

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: env.LLM_SERVER_URL,
            headers: {
                "x-api-key": env.LLM_API_KEY,
            },
        });
    }

    sendUserQuery = async (
        user: IUser,
        message: string,
        sessionId: string,
    ): Promise<Record<string, unknown>> => {
        const payload = { user_id: user._id.toString(), query: message, sessionId };
        console.log("payload", payload);
        const llmResponse = await this.axiosInstance.post("/v1/chat", payload);

        console.log(`LLM response: ${JSON.stringify(llmResponse.data)}`);
        return llmResponse.data;
    };

    sendNameQuery = async (
        freeText: string,
    ): Promise<{ detected_name: string; has_name: boolean }> => {
        console.log("env.LLM_SERVER_URL", env.LLM_SERVER_URL);
        const llmResponse = await this.axiosInstance.post("/v1/chat/username", {
            response: freeText || "",
        });

        console.log(`LLM response: ${JSON.stringify(llmResponse.data)}`);
        return llmResponse.data;
    };
}

export default LLMService;
