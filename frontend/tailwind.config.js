/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                nature: {
                    950: '#0f291e', // Darker background
                    900: '#1a3a2e',
                    800: '#163328',
                    700: '#2d5a4c',
                    600: '#38725f',
                    500: '#438e75',
                    400: '#4ade80', // Vibrant Action
                    300: '#86efac',
                    200: '#bbf7d0',
                    100: '#dcfce7',
                    50: '#f0fdf4',
                }
            }
        },
    },
    plugins: [],
}
