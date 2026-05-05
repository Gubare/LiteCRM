[Setup]
AppName=CRM для малого бизнеса
AppVersion=1.0.0
AppPublisher=Artic Gubare
DefaultDirName={autopf}\CRMApp
DefaultGroupName=CRM App
OutputDir=..\output\installer
OutputBaseFilename=CRM-Setup
Compression=lzma
SolidCompression=yes

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Files]
; Исполняемый файл
Source: "..\bin\neutralino-win_x64.exe"; DestDir: "{app}"; DestName: "crm-app.exe"; Flags: ignoreversion

; ВСЕ файлы ресурсов (рекурсивно)
Source: "..\resources\*"; DestDir: "{app}\resources"; Flags: recursesubdirs createallsubdirs ignoreversion

; Конфигурация
Source: "..\neutralino.config.json"; DestDir: "{app}"; Flags: ignoreversion

; Дополнительные файлы (если есть)
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"
Name: "{autodesktop}\CRM для малого бизнеса"; Filename: "{app}\crm-app.exe"

[Run]
Filename: "{app}\crm-app.exe"; Description: "{cm:LaunchProgram,CRM для малого бизнеса}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"