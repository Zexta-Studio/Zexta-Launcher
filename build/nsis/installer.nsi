; Frontline Project Launcher - NSIS Installer Script with Language Selection
; This script extends the default Electron Builder NSIS installer with custom language selection

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Variables for language selection
Var SELECTED_LANG
Var SELECTED_LANG_CODE
Var LanguageRadioGroup

; Functions
Function nsisPage_SelectLanguage
  !insertmacro MUI_HEADER_TEXT "Language Selection" "Choose your preferred language for the application"
  
  nsDialogs::Create 1018
  Pop $0
  
  ${If} $0 == error
    Abort
  ${EndIf}
  
  ; Create radio group
  ${NSD_CreateGroupBox} 10u 10u 270u 100u "Launcher Language"
  Pop $0
  
  ${NSD_CreateRadioButton} 20u 30u 250u 20u "English"
  Pop $1
  ${NSD_SetState} $1 1
  ${NSD_OnClick} $1 SelectLanguage_EN
  
  ${NSD_CreateRadioButton} 20u 60u 250u 20u "ไทย (Thai)"
  Pop $2
  ${NSD_OnClick} $2 SelectLanguage_TH
  
  ${NSD_CreateLabel} 10u 120u 270u 50u "This language will be used when you first launch the application. You can change it anytime in the launcher settings menu."
  Pop $0
  
  nsDialogs::Show
FunctionEnd

Function nsisPage_SelectLanguageLeave
  ${If} $SELECTED_LANG_CODE == ""
    MessageBox MB_ICONEXCLAMATION "Please select a language to continue."
    Abort
  ${EndIf}
FunctionEnd

Function SelectLanguage_EN
  StrCpy $SELECTED_LANG_CODE "1033"
  StrCpy $SELECTED_LANG "EN"
FunctionEnd

Function SelectLanguage_TH
  StrCpy $SELECTED_LANG_CODE "1054"
  StrCpy $SELECTED_LANG "TH"
FunctionEnd

!macro customPage
  Page custom nsisPage_SelectLanguage nsisPage_SelectLanguageLeave
!macroend

; Installation Hook - Save language preference
!macro customInstall
  SetShellVarContext current
  
  ; Create FrontlineProject directory in AppData
  StrCpy $0 "$APPDATA\FrontlineProject"
  CreateDirectory "$0"
  
  ; Write language preference to file
  FileOpen $1 "$0\language.conf" w
  FileWrite $1 "$SELECTED_LANG"
  FileClose $1
  
  DetailPrint "Language preference saved: $SELECTED_LANG"
!macroend

; Custom Finish Page
!macro customFinish
  MessageBox MB_ICONINFORMATION "Installation complete!$\r$\nLanguage: $SELECTED_LANG$\r$\r$\nClick OK to close the installer." IDOK Done
  Done:
!macroend
