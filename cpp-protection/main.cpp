#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <tlhelp32.h>
#include <string>
#include <vector>
#include <cstdio>

const char* CRACK_PROCESSES[] = {
    "cheatengine.exe", "x64dbg.exe", "x32dbg.exe", "ollydbg.exe",
    "ida.exe", "ida64.exe", "processhacker.exe", "httpdebugger.exe",
    "fiddler.exe", "wireshark.exe", "charles.exe", "dnspy.exe",
    "reclass.exe", "megadumper.exe", "ksdumper.exe", "httpanalyzer.exe"
};

bool isDebuggerPresent() {
    return IsDebuggerPresent() != 0;
}

bool detectBlacklistedProcesses() {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return false;

    PROCESSENTRY32W pe = { sizeof(pe) };
    bool found = false;

    if (Process32FirstW(snap, &pe)) {
        do {
            for (const char* name : CRACK_PROCESSES) {
                int len = MultiByteToWideChar(CP_ACP, 0, name, -1, NULL, 0);
                if (len <= 0) continue;
                std::vector<wchar_t> wname(len);
                MultiByteToWideChar(CP_ACP, 0, name, -1, wname.data(), len);

                if (lstrcmpiW(pe.szExeFile, wname.data()) == 0) {
                    found = true;
                    break;
                }
            }
        } while (Process32NextW(snap, &pe));
    }

    CloseHandle(snap);
    return found;
}

std::string getHwid() {
    char computerName[MAX_COMPUTERNAME_LENGTH + 1] = { 0 };
    DWORD size = sizeof(computerName);
    GetComputerNameA(computerName, &size);
    return std::string(computerName);
}

int main(int argc, char* argv[]) {
    bool hasDebugger = isDebuggerPresent();
    bool hasCrackTools = detectBlacklistedProcesses();

    bool clean = !hasDebugger && !hasCrackTools;

    FILE* out = fopen("protection_result.json", "w");
    if (out) {
        fprintf(out, "{\"ok\":%s,\"debugger\":%s,\"crack_tools\":%s,\"hwid\":\"%s\"}\n",
            clean ? "true" : "false",
            hasDebugger ? "true" : "false",
            hasCrackTools ? "true" : "false",
            getHwid().c_str());
        fclose(out);
    }

    if (argc > 1 && strcmp(argv[1], "--scan") == 0) {
        printf(clean ? "OK\n" : "THREAT\n");
    }

    return clean ? 0 : 1;
}
