import promptSync from 'prompt-sync';

export const prompt = promptSync({ sigint: true });

export function promptInt(ask, value, options) {
    const {
        positiveOnly = true
    } = options ?? {};
    do {
        try {
            const response = prompt(ask, value);
            const parsed = BigInt(response);
            if (!positiveOnly) {
                return parsed;
            }
            if (positiveOnly && parsed >= 0) {
                return parsed;
            }
        } catch (error) {
            if (error.toString() !== `SyntaxError: Cannot convert ${response} to a BigInt`) {
                throw error;
            }
        }
    } while (true);
}

export function promptBool(ask, value) {
    const response = prompt(ask, value);
    const loweredResponse = response.toLowerCase();
    const isTrue = loweredResponse === 'true'
        || loweredResponse === 't'
        || loweredResponse === 'yes'
        || loweredResponse === 'y';
    return isTrue;
}