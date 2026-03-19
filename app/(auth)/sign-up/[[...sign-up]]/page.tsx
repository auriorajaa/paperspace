import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="fixed top-[-20%] right-[20%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[10%] w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg
              width="16"
              height="16"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 2h6l3 3v7H2V2z"
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M8 2v3h3"
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M4 7h5M4 9.5h3"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-white text-base font-semibold tracking-tight">
            Paperspace
          </span>
        </div>

        <SignUp />
      </div>
    </div>
  );
}
