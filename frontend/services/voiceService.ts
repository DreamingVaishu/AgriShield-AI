import * as Speech from 'expo-speech';

export type Language = 'en' | 'hi' | 'mr';

export interface VoiceOptions {
    language: Language;
    pitch?: number;
    rate?: number;
}

const LANGUAGE_CODES: Record<Language, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    mr: 'mr-IN',
};

export async function speak(text: string, options: VoiceOptions = { language: 'hi' }): Promise<void> {
    try {
        await stop();

        const languageCode = LANGUAGE_CODES[options.language];

        await Speech.speak(text, {
            language: languageCode,
            pitch: options.pitch || 1.0,
            rate: options.rate || 0.85,
            onDone: () => console.log('Speech completed'),
            onError: (error) => console.error('Speech error:', error),
        });
    } catch (error) {
        console.error('Error in speak function:', error);
    }
}

export async function stop(): Promise<void> {
    try {
        await Speech.stop();
    } catch (error) {
        console.error('Error stopping speech:', error);
    }
}

export async function isSpeaking(): Promise<boolean> {
    try {
        return await Speech.isSpeakingAsync();
    } catch (error) {
        console.error('Error checking speech status:', error);
        return false;
    }
}

export async function speakDiseaseResult(
    diseaseName: string,
    treatment: string,
    language: Language = 'hi'
): Promise<void> {
    const message = `${diseaseName}. ${treatment}`;
    await speak(message, { language, rate: 0.8 });
}

export async function getAvailableVoices(language: Language): Promise<Speech.Voice[]> {
    try {
        const allVoices = await Speech.getAvailableVoicesAsync();
        const languageCode = LANGUAGE_CODES[language];
        return allVoices.filter(voice => voice.language.startsWith(languageCode.split('-')[0]));
    } catch (error) {
        console.error('Error getting available voices:', error);
        return [];
    }
}

export async function speakWelcome(language: Language = 'hi'): Promise<void> {
    const messages: Record<Language, string> = {
        en: 'Welcome to AgriShield AI. Scan your crop leaf to detect diseases.',
        hi: 'एग्रीशील्ड एआई में आपका स्वागत है। रोगों का पता लगाने के लिए अपनी फसल की पत्ती स्कैन करें।',
        mr: 'एग्रीशील्ड एआय मध्ये आपले स्वागत आहे. रोग शोधण्यासाठी आपल्या पिकाचे पान स्कॅन करा.',
    };

    await speak(messages[language], { language });
}
