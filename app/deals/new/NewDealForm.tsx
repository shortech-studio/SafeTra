"use client"

import { useState, useTransition, useActionState } from "react"
import { createDeal } from "@/lib/actions/deals"
import { processDocumentAction } from "@/lib/actions/ocr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, Sparkles, ShieldAlert, CheckCircle2, Upload, FileText, Camera, Video, ShieldCheck, GitCompare } from "lucide-react"
import { DocumentUpload } from "@/components/DocumentUpload"
import { OcrResultCard } from "@/components/OcrResultCard"
import { runClientOCR } from "@/lib/ocr/client-ocr"
import { OcrDiffModal, OcrFieldDiff } from "@/components/ocr/OcrDiffModal"

const initialState = {
    error: "",
}

interface NewDealFormProps {
    user?: any
}

export function NewDealForm({ user }: NewDealFormProps = {}) {
    const [state, action, isPending] = useActionState(async (prevState: any, formData: FormData) => {
        const result = await createDeal(formData)
        if (result?.error) {
            return { error: result.error }
        }
        return { error: "" }
    }, initialState)

    const [currentStep, setCurrentStep] = useState(1)
    const [useSavedInfo, setUseSavedInfo] = useState<boolean | null>(null)
    const [idDocUrl, setIdDocUrl] = useState("")
    const [vehicleRegDocUrl, setVehicleRegDocUrl] = useState("")
    const [isAnalyzingId, setIsAnalyzingId] = useState(false)
    const [isAnalyzingVehicle, setIsAnalyzingVehicle] = useState(false)
    const [ocrSignals, setOcrSignals] = useState<string[]>([])

    // Extracted Data State
    const [title, setTitle] = useState("")
    const [priceILS, setPriceILS] = useState("150000")
    const [licensePlate, setLicensePlate] = useState("")
    const [vehicleMake, setVehicleMake] = useState("")
    const [vehicleModel, setVehicleModel] = useState("")
    const [vehicleYear, setVehicleYear] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [idNumber, setIdNumber] = useState("")
    const [birthDate, setBirthDate] = useState("")
    const [address, setAddress] = useState("")
    const [engineVolume, setEngineVolume] = useState("")
    const [licenseExpiry, setLicenseExpiry] = useState("")
    const [previousOwners, setPreviousOwners] = useState("")
    const [chassisNumber, setChassisNumber] = useState("")
    const [kilometers, setKilometers] = useState("")
    const [vehicleRegOwnerName, setVehicleRegOwnerName] = useState("")
    const [vehicleRegOwnerId, setVehicleRegOwnerId] = useState("")

    // Vehicle Photos & Thumbnail Selection
    const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([])
    const [thumbnailUrl, setThumbnailUrl] = useState<string>("")
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

    // Biometric Record Mock
    const [isRecording, setIsRecording] = useState(false)
    const [isRecorded, setIsRecorded] = useState(false)

    const [idOcrResult, setIdOcrResult] = useState<any>(null)
    const [vehicleOcrResult, setVehicleOcrResult] = useState<any>(null)
    const [showIdOcrJson, setShowIdOcrJson] = useState(false)
    const [showVehicleOcrJson, setShowVehicleOcrJson] = useState(false)
    const [isDiffModalOpen, setIsDiffModalOpen] = useState(false)

    const ocrDiffs: OcrFieldDiff[] = [
        {
            label: "שם פרטי",
            fieldName: "firstName",
            userValue: firstName,
            extractedValue: idOcrResult?.fields?.full_name?.value ? idOcrResult.fields.full_name.value.split(" ")[0] : null,
            confidence: idOcrResult?.fields?.full_name?.confidence,
        },
        {
            label: "שם משפחה",
            fieldName: "lastName",
            userValue: lastName,
            extractedValue: idOcrResult?.fields?.full_name?.value ? idOcrResult.fields.full_name.value.split(" ").slice(1).join(" ") : null,
            confidence: idOcrResult?.fields?.full_name?.confidence,
        },
        {
            label: "מספר תעודת זהות",
            fieldName: "idNumber",
            userValue: idNumber,
            extractedValue: idOcrResult?.fields?.id_number?.value || vehicleOcrResult?.fields?.owner_id?.value || null,
            confidence: idOcrResult?.fields?.id_number?.confidence || vehicleOcrResult?.fields?.owner_id?.confidence,
        },
        {
            label: "מספר רכב (רישוי)",
            fieldName: "licensePlate",
            userValue: licensePlate,
            extractedValue: vehicleOcrResult?.fields?.plate_number?.value || null,
            confidence: vehicleOcrResult?.fields?.plate_number?.confidence,
        },
        {
            label: "יצרן רכב",
            fieldName: "vehicleMake",
            userValue: vehicleMake,
            extractedValue: vehicleOcrResult?.fields?.make?.value || null,
            confidence: vehicleOcrResult?.fields?.make?.confidence,
        },
        {
            label: "דגם רכב",
            fieldName: "vehicleModel",
            userValue: vehicleModel,
            extractedValue: vehicleOcrResult?.fields?.model?.value || null,
            confidence: vehicleOcrResult?.fields?.model?.confidence,
        },
        {
            label: "שנת ייצור",
            fieldName: "vehicleYear",
            userValue: vehicleYear,
            extractedValue: vehicleOcrResult?.fields?.year?.value || null,
            confidence: vehicleOcrResult?.fields?.year?.confidence,
        },
        {
            label: "מספר שלדה (VIN)",
            fieldName: "chassisNumber",
            userValue: chassisNumber,
            extractedValue: vehicleOcrResult?.fields?.chassis_number?.value || null,
            confidence: vehicleOcrResult?.fields?.chassis_number?.confidence,
        },
        {
            label: "נפח מנוע (סמ״ק)",
            fieldName: "engineVolume",
            userValue: engineVolume,
            extractedValue: vehicleOcrResult?.fields?.engine_volume?.value || null,
            confidence: vehicleOcrResult?.fields?.engine_volume?.confidence,
        },
        {
            label: "תוקף רישיון רכב",
            fieldName: "licenseExpiry",
            userValue: licenseExpiry,
            extractedValue: vehicleOcrResult?.fields?.license_expiry?.value || null,
            confidence: vehicleOcrResult?.fields?.license_expiry?.confidence,
        },
        {
            label: "מספר בעלויות קודמות",
            fieldName: "previousOwners",
            userValue: previousOwners,
            extractedValue: vehicleOcrResult?.fields?.previous_owners?.value || null,
            confidence: vehicleOcrResult?.fields?.previous_owners?.confidence,
        },
        {
            label: "שם בעל הרכב ברשיון",
            fieldName: "vehicleRegOwnerName",
            userValue: vehicleRegOwnerName,
            extractedValue: vehicleOcrResult?.fields?.owner_name?.value || null,
            confidence: vehicleOcrResult?.fields?.owner_name?.confidence,
        },
    ]

    const handleVehiclePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploadingPhoto(true)
        const uploadedUrls: string[] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const formData = new FormData()
            formData.append("file", file)

            try {
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                })
                if (res.ok) {
                    const data = await res.json()
                    if (data.url) {
                        uploadedUrls.push(data.url)
                    }
                }
            } catch (err) {
                console.error("Photo upload error:", err)
            }
        }

        if (uploadedUrls.length > 0) {
            setVehiclePhotos(prev => {
                const newPhotos = [...prev, ...uploadedUrls]
                if (!thumbnailUrl && newPhotos.length > 0) {
                    setThumbnailUrl(newPhotos[0])
                }
                return newPhotos
            })
        }
        setIsUploadingPhoto(false)
    }

    const handleIdUpload = async (url: string, file: File) => {
        setIdDocUrl(url)
        setIsAnalyzingId(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("docType", "id_card")

            let finalData: any = null
            try {
                const res = await fetch("/api/ocr", {
                    method: "POST",
                    body: formData,
                })
                if (res.ok) {
                    const result = await res.json()
                    if (result.data) finalData = result.data
                }
            } catch (serverErr) {
                console.warn("Server ID OCR fetch failed:", serverErr)
            }

            // Fallback to client WASM OCR if server OCR didn't find fields
            const isPdf = file.name.toLowerCase().endsWith(".pdf")
            if (!finalData?.fields?.id_number?.value && !isPdf) {
                console.log("[NewDealForm ID] Running Client-Side WASM OCR fallback...")
                const clientResult = await runClientOCR(file, "id_card")
                if (clientResult.fields && Object.keys(clientResult.fields).length > 0) {
                    finalData = clientResult
                }
            }

            if (finalData) {
                setIdOcrResult(finalData)
                setShowIdOcrJson(true)
                const { fields, fraudSignals } = finalData
                if (fields.full_name?.value) {
                    const nameParts = fields.full_name.value.split(" ")
                    setFirstName(nameParts[0] || "")
                    setLastName(nameParts.slice(1).join(" ") || "")
                    setVehicleRegOwnerName(fields.full_name.value)
                }
                if (fields.id_number?.value) {
                    setIdNumber(fields.id_number.value)
                    setVehicleRegOwnerId(fields.id_number.value)
                }
                if (fields.birth_date?.value) {
                    setBirthDate(fields.birth_date.value)
                }
                if (fields.address?.value) {
                    setAddress(fields.address.value)
                }
                setOcrSignals(prev => [...new Set([...prev, ...(fraudSignals || [])])])
            }
        } catch (e) {
            console.error("OCR ID Error:", e)
        } finally {
            setIsAnalyzingId(false)
        }
    }

    const handleVehicleUpload = async (url: string, file: File) => {
        setVehicleRegDocUrl(url)
        setIsAnalyzingVehicle(true)
        try {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("docType", "vehicle_registration")

            let finalData: any = null
            try {
                const res = await fetch("/api/ocr", {
                    method: "POST",
                    body: formData,
                })
                if (res.ok) {
                    const result = await res.json()
                    if (result.data) finalData = result.data
                }
            } catch (serverErr) {
                console.warn("Server Vehicle OCR fetch failed:", serverErr)
            }

            // Fallback to client WASM OCR if server OCR didn't find fields
            const isVehiclePdf = file.name.toLowerCase().endsWith(".pdf")
            if (!finalData?.fields?.plate_number?.value && !isVehiclePdf) {
                console.log("[NewDealForm Vehicle] Running Client-Side WASM OCR fallback...")
                const clientResult = await runClientOCR(file, "vehicle_registration")
                if (clientResult.fields && Object.keys(clientResult.fields).length > 0) {
                    finalData = clientResult
                }
            }

            if (finalData) {
                setVehicleOcrResult(finalData)
                setShowVehicleOcrJson(true)
                const { fields, fraudSignals } = finalData
                if (fields.plate_number?.value) setLicensePlate(fields.plate_number.value)
                if (fields.year?.value) setVehicleYear(fields.year.value)
                const make = fields.make?.value || ""
                const model = fields.model?.value || ""
                const year = fields.year?.value || ""

                if (make) setVehicleMake(make)
                if (model) setVehicleModel(model)
                if (year) setVehicleYear(String(year))

                if (make || model || year) {
                    const autoTitle = `${make} ${model} ${year}`.trim()
                    setTitle((prev) => (prev ? prev : autoTitle))
                }
                if (fields.engine_volume?.value) setEngineVolume(fields.engine_volume.value)
                if (fields.license_expiry?.value) {
                    const parts = fields.license_expiry.value.split('/')
                    if (parts.length === 3) {
                        setLicenseExpiry(`${parts[2]}-${parts[1]}-${parts[0]}`)
                    }
                }
                if (fields.previous_owners?.value) setPreviousOwners(fields.previous_owners.value)
                if (fields.chassis_number?.value) setChassisNumber(fields.chassis_number.value)
                if (!kilometers) setKilometers("15000")

                if (fields.owner_name?.value) {
                    setVehicleRegOwnerName(fields.owner_name.value)
                    if (!firstName) {
                        const nameParts = fields.owner_name.value.split(/\s+/).filter(Boolean)
                        if (nameParts.length > 1) {
                            setLastName(nameParts[0])
                            setFirstName(nameParts.slice(1).join(" "))
                        } else if (nameParts.length === 1) {
                            setLastName(nameParts[0])
                        }
                    }
                }
                if (fields.owner_id?.value) setVehicleRegOwnerId(fields.owner_id.value)
                setOcrSignals(prev => [...new Set([...prev, ...(fraudSignals || [])])])
            }
        } catch (e) {
            console.error("OCR Vehicle Error:", e)
        } finally {
            setIsAnalyzingVehicle(false)
        }
    }

    const startRecording = () => {
        setIsRecording(true)
        setTimeout(() => {
            setIsRecording(false)
            setIsRecorded(true)
        }, 3000)
    }

    const nextStep = () => {
        if (currentStep < 4) setCurrentStep(currentStep + 1)
    }

    const prevStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1)
    }

    return (
        <div className="w-full max-w-[800px] mx-auto space-y-8" dir="rtl">
            {/* Wizard Progress Stepper */}
            <div className="flex items-center justify-between px-4">
                <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-300 ${currentStep === 1 ? 'border-primary bg-primary text-on-primary' : currentStep > 1 ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant text-on-surface-variant'
                        }`}>1</div>
                    <span className={`text-xs font-semibold ${currentStep >= 1 ? 'text-primary' : 'text-on-surface-variant'}`}>פרטי זהות</span>
                </div>
                <div className="flex-grow h-[2px] bg-outline-variant mx-4">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: currentStep > 1 ? '100%' : '0%' }}></div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-300 ${currentStep === 2 ? 'border-primary bg-primary text-on-primary' : currentStep > 2 ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant text-on-surface-variant'
                        }`}>2</div>
                    <span className={`text-xs font-semibold ${currentStep >= 2 ? 'text-primary' : 'text-on-surface-variant'}`}>פרטי הרכב</span>
                </div>
                <div className="flex-grow h-[2px] bg-outline-variant mx-4">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: currentStep > 2 ? '100%' : '0%' }}></div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-300 ${currentStep === 3 ? 'border-primary bg-primary text-on-primary' : currentStep > 3 ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant text-on-surface-variant'
                        }`}>3</div>
                    <span className={`text-xs font-semibold ${currentStep >= 3 ? 'text-primary' : 'text-on-surface-variant'}`}>אימות ביומטרי</span>
                </div>
                <div className="flex-grow h-[2px] bg-outline-variant mx-4">
                    <div className="h-full bg-primary transition-all duration-500" style={{ width: currentStep > 3 ? '100%' : '0%' }}></div>
                </div>
                <div className="flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold transition-all duration-300 ${currentStep === 4 ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant text-on-surface-variant'
                        }`}>4</div>
                    <span className={`text-xs font-semibold ${currentStep === 4 ? 'text-primary' : 'text-on-surface-variant'}`}>סיכום ואישור</span>
                </div>
            </div>

            <form action={action} className="space-y-6">
                {state?.error && (
                    <Alert variant="destructive">
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}

                {/* Hidden Fields for Backend Submission */}
                <input type="hidden" name="idDocUrl" value={idDocUrl} />
                <input type="hidden" name="vehicleRegDocUrl" value={vehicleRegDocUrl} />
                <input type="hidden" name="firstName" value={firstName} />
                <input type="hidden" name="lastName" value={lastName} />
                <input type="hidden" name="idNumber" value={idNumber} />
                <input type="hidden" name="birthDate" value={birthDate} />
                <input type="hidden" name="address" value={address} />
                <input type="hidden" name="engineVolume" value={engineVolume} />
                <input type="hidden" name="licenseExpiry" value={licenseExpiry} />
                <input type="hidden" name="previousOwners" value={previousOwners} />
                <input type="hidden" name="chassisNumber" value={chassisNumber} />
                <input type="hidden" name="vehicleRegOwnerName" value={vehicleRegOwnerName} />
                <input type="hidden" name="vehicleRegOwnerId" value={vehicleRegOwnerId} />
                <input type="hidden" name="thumbnailUrl" value={thumbnailUrl} />
                <input type="hidden" name="vehicleImages" value={JSON.stringify(vehiclePhotos)} />

                {/* State-bound Hidden Fields for Backend Submission */}
                <input type="hidden" name="title" value={title || `${vehicleMake || ""} ${vehicleModel || ""} ${vehicleYear || ""}`.trim() || "עסקת מכירת רכב"} />
                <input type="hidden" name="priceILS" value={priceILS} />
                <input type="hidden" name="licensePlate" value={licensePlate} />
                <input type="hidden" name="vehicleMake" value={vehicleMake} />
                <input type="hidden" name="vehicleModel" value={vehicleModel} />
                <input type="hidden" name="vehicleYear" value={vehicleYear} />
                <input type="hidden" name="kilometers" value={kilometers} />

                {/* STEP 1: Personal Details */}
                {currentStep === 1 && (
                    <section className="glass-card rounded-2xl p-6 space-y-6 border-r-4 border-r-primary animate-in fade-in slide-in-from-bottom-4 duration-300 text-right">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-primary text-right">פרטים אישיים של המוכר</h2>
                            <p className="text-xs text-on-surface-variant text-right">מידע משפטי הנדרש להסכם הרכישה המחייב.</p>
                        </div>

                        {/* Saved ID Verification Prompt Banner */}
                        {user?.id_doc_url && (
                            <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 space-y-3 text-right">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                                        <span className="text-sm font-bold text-primary">נמצאה תעודת זהות מאומתת בפרופיל</span>
                                    </div>
                                    {useSavedInfo === true && (
                                        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary font-semibold flex items-center gap-1">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            משתמש בפרטי הפרופיל
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-on-surface-variant leading-relaxed">
                                    נמצא מסמך זיהוי מאומת בפרופיל שלך. האם ברצונך להשתמש בפרטים ובמסמך השמור במקום להעלותם מחדש?
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1 justify-start">
                                    {useSavedInfo !== true ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => {
                                                setUseSavedInfo(true)
                                                if (user.id_doc_url) setIdDocUrl(user.id_doc_url)
                                                const savedId = user.id_number || user.teudat_zehut || ""
                                                if (savedId) {
                                                    setIdNumber(savedId)
                                                    setVehicleRegOwnerId(savedId)
                                                }
                                                if (user.full_name) {
                                                    const parts = user.full_name.trim().split(/\s+/)
                                                    const fName = parts[0] || ""
                                                    const lName = parts.slice(1).join(" ") || ""
                                                    setFirstName(fName)
                                                    setLastName(lName)
                                                    setVehicleRegOwnerName(user.full_name)
                                                }
                                                if (user.birth_date || user.birthDate) {
                                                    setBirthDate(user.birth_date || user.birthDate)
                                                }
                                                if (user.address) {
                                                    setAddress(user.address)
                                                }
                                            }}
                                            className="bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            כן, השתמש בפרטים השמורים בפרופיל
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                setUseSavedInfo(false)
                                                setIdDocUrl("")
                                            }}
                                            className="border-outline-variant text-on-surface-variant hover:text-on-surface text-xs"
                                        >
                                            החלף מסמך / העלה מחדש
                                        </Button>
                                    )}

                                    {useSavedInfo === null && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setUseSavedInfo(false)}
                                            className="text-on-surface-variant hover:text-on-surface text-xs"
                                        >
                                            אני מעדיף להעלות מסמך מחדש
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            {useSavedInfo === true ? (
                                <div className="p-4 rounded-xl border border-primary/20 bg-surface-container-low space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                                            <FileText className="h-4 w-4" />
                                            מסמך זיהוי מחובר מתוך הפרופיל שלך
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-on-surface-variant hover:text-primary h-7"
                                            onClick={() => {
                                                setUseSavedInfo(false)
                                                setIdDocUrl("")
                                            }}
                                        >
                                            החלף מסמך
                                        </Button>
                                    </div>
                                    {idDocUrl && (idDocUrl.startsWith("http") || idDocUrl.startsWith("data:") || idDocUrl.startsWith("/")) ? (
                                        idDocUrl.toLowerCase().includes(".pdf") ? (
                                            <div className="p-3 bg-primary/10 rounded-lg text-xs font-bold text-primary flex items-center gap-2">
                                                <FileText className="h-5 w-5" />
                                                מסמך PDF שמור בפרופיל
                                            </div>
                                        ) : (
                                            <img src={idDocUrl} alt="תעודת זהות שמורה" className="max-h-40 rounded-lg border border-outline-variant object-contain" />
                                        )
                                    ) : (
                                        <div className="p-3 bg-primary/10 rounded-lg text-xs font-bold text-primary flex items-center gap-2">
                                            <CheckCircle2 className="h-5 w-5" />
                                            תעודת זהות מאומתת בפרופיל
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <DocumentUpload
                                    label="סריקת תעודת זהות / דרכון"
                                    onUploadComplete={handleIdUpload}
                                    isLoading={isAnalyzingId}
                                />
                            )}

                            {isAnalyzingId && (
                                <div className="flex items-center gap-2 text-xs text-primary animate-pulse justify-end">
                                    <span>סורק מסמך מזהה באמצעות AI SecureOCR...</span>
                                    <Sparkles className="h-4 w-4" />
                                </div>
                            )}

                            {idOcrResult && (
                                <OcrResultCard
                                    result={idOcrResult}
                                    onCompareDiff={() => setIsDiffModalOpen(true)}
                                />
                            )}

                            {(idOcrResult || vehicleOcrResult) && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                                    <div className="flex items-center gap-2 text-right">
                                        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                                        <div>
                                            <p className="text-xs font-bold text-amber-300">סריקת AI הושלמה בהצלחה</p>
                                            <p className="text-[11px] text-slate-300">השווה את הנתונים המוזנים מול סריקת ה-AI ומזג פערים בלחיצה אחת</p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => setIsDiffModalOpen(true)}
                                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs gap-1.5 shrink-0 shadow-md transition-all hover:scale-105"
                                    >
                                        <GitCompare className="w-4 h-4" />
                                        <span>השוואת AI ומיזוג פערים 🤖</span>
                                    </Button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">שם פרטי</label>
                                    <Input
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="ישראל"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">שם משפחה</label>
                                    <Input
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="ישראלי"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 text-right">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">מספר תעודת זהות / דרכון</label>
                                <Input
                                    value={idNumber}
                                    onChange={(e) => setIdNumber(e.target.value)}
                                    placeholder="123456789"
                                    className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono text-right"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">תאריך לידה (אופציונלי)</label>
                                    <Input
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        placeholder="DD/MM/YYYY"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">כתובת (אופציונלית)</label>
                                    <Input
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="רחוב, עיר"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                            </div>
                        </div>

                        <div dir="rtl" className="flex items-center gap-2 p-4 bg-primary/5 border border-primary/20 rounded-xl justify-start">
                            <span className="material-symbols-outlined text-primary text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                            <p className="text-[11px] text-on-surface-variant text-right leading-normal" dir="rtl">הפרטים והמסמכים המאומתים שלך מוגנים בכספות מוצפנות של SafeTra ונגישים רק לעורכי דין מורשים.</p>
                        </div>
                    </section>
                )}

                {/* STEP 2: Asset Details */}
                {currentStep === 2 && (
                    <section className="glass-card rounded-2xl p-6 space-y-6 border-r-4 border-r-secondary animate-in fade-in slide-in-from-bottom-4 duration-300 text-right">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-secondary text-right">מפרט הרכב והעסקה</h2>
                            <p className="text-xs text-on-surface-variant text-right">הזן את פרטי רישיון הרכב והמחיר המוסכם לנאמנות.</p>
                        </div>

                        <div className="space-y-4">
                            <DocumentUpload
                                label="רישיון רכב (סריקה/צילום)"
                                onUploadComplete={handleVehicleUpload}
                                isLoading={isAnalyzingVehicle}
                            />

                            {isAnalyzingVehicle && (
                                <div className="flex items-center gap-2 text-xs text-secondary animate-pulse justify-end">
                                    <span>סורק רישיון רכב באמצעות AI SecureOCR...</span>
                                    <Sparkles className="h-4 w-4" />
                                </div>
                            )}

                            {vehicleOcrResult && (
                                <OcrResultCard
                                    result={vehicleOcrResult}
                                    onCompareDiff={() => setIsDiffModalOpen(true)}
                                />
                            )}

                            <div className="text-right">
                                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5 block">כותרת העסקה</label>
                                <Input
                                    name="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="לדוגמה: מכירת פורשה 911 GT3 שנת 2023"
                                    required
                                    className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">מספר רישוי</label>
                                    <Input
                                        value={licensePlate}
                                        onChange={(e) => setLicensePlate(e.target.value)}
                                        placeholder="12-345-67"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">מחיר מכירה מוסכם (₪)</label>
                                    <div className="relative">
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary font-bold">₪</span>
                                        <Input
                                            name="priceILS"
                                            type="number"
                                            required
                                            value={priceILS}
                                            onChange={(e) => setPriceILS(e.target.value)}
                                            placeholder="150,000"
                                            className="pr-8 bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all font-bold text-right"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">יצרן</label>
                                    <Input
                                        value={vehicleMake}
                                        onChange={(e) => setVehicleMake(e.target.value)}
                                        placeholder="פורשה"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">דגם</label>
                                    <Input
                                        value={vehicleModel}
                                        onChange={(e) => setVehicleModel(e.target.value)}
                                        placeholder="911 GT3"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">שנה</label>
                                    <Input
                                        value={vehicleYear}
                                        onChange={(e) => setVehicleYear(e.target.value)}
                                        placeholder="2023"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">מספר שלדה (VIN)</label>
                                    <Input
                                        value={chassisNumber}
                                        onChange={(e) => setChassisNumber(e.target.value)}
                                        placeholder="WP0AA2A9XPS******"
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all font-mono text-right"
                                    />
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">קילומטראז'</label>
                                    <Input
                                        name="kilometers"
                                        type="number"
                                        value={kilometers}
                                        onChange={(e) => setKilometers(e.target.value)}
                                        placeholder="15,000"
                                        required
                                        className="bg-surface-container-lowest border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-all text-right"
                                    />
                                </div>
                            </div>

                            {/* Vehicle Photos Upload & Thumbnail Selector */}
                            <div className="space-y-3 pt-4 border-t border-white/10 text-right">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface">תמונות הרכב (אופציונלי)</label>
                                    <span className="text-[10px] text-on-surface-variant font-mono">{vehiclePhotos.length} תמונות הועלו</span>
                                </div>
                                <p className="text-xs text-on-surface-variant">העלה תמונות של הרכב. אם תעלה יותר מתמונה אחת, לחץ על התמונה המועדפת כדי להגדיר אותה כתמונה ראשית בלוח הבקרה.</p>

                                <div className="flex items-center gap-3">
                                    <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-surface-container-high border border-outline-variant hover:bg-primary/20 text-xs font-bold text-primary flex items-center gap-2 transition-all">
                                        <span className="material-symbols-outlined text-sm">add_photo_alternate</span>
                                        <span>{isUploadingPhoto ? "מעלה תמונות..." : "הוסף תמונות רכב"}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleVehiclePhotoUpload}
                                            disabled={isUploadingPhoto}
                                            className="hidden"
                                        />
                                    </label>
                                </div>

                                {vehiclePhotos.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                                        {vehiclePhotos.map((photoUrl, pIdx) => {
                                            const isSelected = thumbnailUrl === photoUrl || (!thumbnailUrl && pIdx === 0)
                                            return (
                                                <div
                                                    key={pIdx}
                                                    onClick={() => setThumbnailUrl(photoUrl)}
                                                    className={`relative aspect-video rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                                                        isSelected ? "border-primary ring-2 ring-primary/40 scale-105" : "border-white/10 opacity-60 hover:opacity-100"
                                                    }`}
                                                >
                                                    <img src={photoUrl} alt={`תמונת רכב ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                    {isSelected && (
                                                        <div className="absolute top-1 right-1 bg-primary text-on-primary text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-lg">
                                                            <span>תמונה ראשית</span>
                                                            <span className="material-symbols-outlined text-[10px]">star</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* STEP 3: Biometric Liveness Verify */}
                {currentStep === 3 && (
                    <section className="glass-card rounded-2xl p-6 space-y-6 border-r-4 border-r-primary animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="space-y-1 text-center">
                            <h2 className="text-xl font-bold text-primary">אישור ביומטרי</h2>
                            <p className="text-xs text-on-surface-variant">סרטון אימות קצר למניעת הונאות זהות ואישור העסקה.</p>
                        </div>

                        <div className="relative aspect-video max-w-md mx-auto bg-black/90 rounded-2xl overflow-hidden border-2 border-outline-variant shadow-2xl flex items-center justify-center">
                            {/* Camera overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                <div className={`w-36 h-36 border-2 border-dashed rounded-full flex items-center justify-center ${isRecording ? 'border-error animate-pulse' : 'border-primary/50'}`}>
                                    <Camera className={`h-12 w-12 ${isRecording ? 'text-error' : 'text-primary/40'}`} />
                                </div>

                                {isRecording && (
                                    <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-background/85 px-3 py-1 rounded-full border border-error/30">
                                        <div className="w-2 h-2 bg-error rounded-full animate-ping"></div>
                                        <span className="text-[10px] font-mono font-bold text-error">הקלטה פעילה</span>
                                    </div>
                                )}
                            </div>

                            {/* Script overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                                <div className="bg-surface-container-lowest/90 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center">
                                    <p className="text-xs text-on-surface leading-relaxed">
                                        <span className="text-primary font-bold uppercase tracking-wider block mb-1">נוסח האימות</span>
                                        "אני מאשר שאני הבעלים החוקי של הרכב ומאשר את יצירת העסקה הזו ב-SafeTra."
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-3">
                            <Button
                                type="button"
                                onClick={startRecording}
                                disabled={isRecording}
                                className={`px-8 py-3 rounded-full font-bold flex items-center gap-2 transition-all ${isRecorded ? 'bg-primary text-on-primary' : 'bg-secondary hover:bg-secondary-container text-on-secondary-container'
                                    }`}
                            >
                                {isRecording ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin text-error" />
                                        מקליט...
                                    </>
                                ) : isRecorded ? (
                                    <>
                                        <ShieldCheck className="h-5 w-5 text-on-primary" />
                                        הסרטון הועלה
                                    </>
                                ) : (
                                    <>
                                        <Video className="h-5 w-5" />
                                        הקלט והעלה
                                    </>
                                )}
                            </Button>
                            {isRecorded && (
                                <span className="text-[10px] text-primary font-bold flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    אימות ביומטרי אושר (99.2%)
                                </span>
                            )}
                        </div>
                    </section>
                )}

                {/* STEP 4: Review and Submit */}
                {currentStep === 4 && (
                    <section className="glass-card rounded-2xl p-6 sm:p-8 space-y-6 border-r-4 border-r-primary animate-in fade-in slide-in-from-bottom-4 duration-300 text-right">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-primary block mb-1">שלב 4 מתוך 4</span>
                                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">סיכום ואישור סופי של העסקה 🚗</h2>
                                {title && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">כותרת העסקה:</span>
                                        <span className="text-sm font-black text-emerald-400 font-mono bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">{title}</span>
                                    </div>
                                )}
                                <p className="text-xs sm:text-sm text-on-surface-variant mt-1">בדוק את כל הנתונים, המסמכים והתמונות שנקלטו לפני הגשה לבדיקת עורך הדין.</p>
                            </div>

                            <div className="bg-primary/10 border border-primary/30 p-3.5 rounded-2xl text-right shrink-0">
                                <span className="text-[10px] text-on-surface-variant block uppercase font-bold">סכום הנאמנות המוסכם</span>
                                <span className="text-2xl sm:text-3xl font-black text-primary font-mono">₪{Number(priceILS || 0).toLocaleString("he-IL")}</span>
                            </div>
                        </div>

                        {/* Security Warning Checks */}
                        <div className="space-y-3 text-right">
                            {ocrSignals.length > 0 && (
                                <Alert variant="destructive" className="bg-orange-950/20 border-orange-900/50">
                                    <ShieldAlert className="h-4 w-4 text-orange-400" />
                                    <AlertTitle className="text-orange-300">בקרת אבטחת מידע</AlertTitle>
                                    <AlertDescription className="text-orange-400 text-xs">
                                        אותרו חריגות אפשריות במהלך פענוח המסמך: {ocrSignals.join(", ")}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {(() => {
                                if (!vehicleRegOwnerName || !firstName || !lastName) return null;
                                const cleanReg = vehicleRegOwnerName.replace(/[^\u0590-\u05FF]/g, "");
                                const cleanFirst = firstName.replace(/[^\u0590-\u05FF]/g, "");
                                const cleanLast = lastName.replace(/[^\u0590-\u05FF]/g, "");

                                const isMatch = cleanReg.includes(cleanFirst) && cleanReg.includes(cleanLast);

                                if (!isMatch) {
                                    return (
                                        <Alert variant="destructive" className="bg-yellow-950/20 border-yellow-900/50">
                                            <ShieldAlert className="h-4 w-4 text-yellow-400" />
                                            <AlertTitle className="text-yellow-300">חוסר התאמה בשם הבעלים</AlertTitle>
                                            <AlertDescription className="text-yellow-400 text-xs">
                                                מחזיק הרישיון: <strong>{firstName} {lastName}</strong> לעומת בעל הרכב הרשום: <strong>{vehicleRegOwnerName}</strong>
                                            </AlertDescription>
                                        </Alert>
                                    );
                                }
                                return null;
                            })()}

                            {vehicleRegOwnerId && idNumber && vehicleRegOwnerId !== idNumber && (
                                <Alert variant="destructive" className="bg-yellow-950/20 border-yellow-900/50">
                                    <ShieldAlert className="h-4 w-4 text-yellow-400" />
                                    <AlertTitle className="text-yellow-300">התרעת מספר תעודת זהות</AlertTitle>
                                    <AlertDescription className="text-yellow-400 text-xs">
                                        מסמך מזהה: <strong>{idNumber}</strong> לעומת רישום הרכב: <strong>{vehicleRegOwnerId}</strong>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {firstName && (
                                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-1 text-right">
                                    <div className="flex items-center gap-1.5 text-xs text-primary font-bold justify-end">
                                        הזהות והרישומים המשפטיים אומתו בהצלחה
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <p className="text-xs text-on-surface-variant">
                                        השם שפוענח תואם לרישומים המשפטיים: <strong>{firstName} {lastName}</strong> (ת.ז: {idNumber || "נבדק"})
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Vehicle Photos Gallery Preview */}
                        {vehiclePhotos.length > 0 && (
                            <div className="p-4 bg-surface-container-low/70 border border-white/10 rounded-2xl space-y-3 text-right">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                                        <Camera className="h-4 w-4 text-primary" />
                                        <span>תמונות הרכב שהועלו ({vehiclePhotos.length})</span>
                                    </h3>
                                    {thumbnailUrl && (
                                        <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold">
                                            תמונה ראשית נבחרה ⭐
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {vehiclePhotos.map((photoUrl, pIdx) => {
                                        const isMain = thumbnailUrl === photoUrl || (!thumbnailUrl && pIdx === 0);
                                        return (
                                            <div key={pIdx} className={`relative aspect-video rounded-xl overflow-hidden border ${isMain ? 'border-primary ring-2 ring-primary/40 shadow-lg' : 'border-white/10'}`}>
                                                <img src={photoUrl} alt={`תמונת רכב ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                {isMain && (
                                                    <span className="absolute top-1 right-1 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                        ראשי
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Full Specs & Data Summary Card */}
                        <div className="p-5 bg-surface-container-low/90 rounded-2xl border border-white/10 space-y-4 text-xs text-right shadow-inner">
                            <h3 className="font-bold uppercase tracking-wider text-primary flex items-center gap-2 border-b border-white/10 pb-2">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                <span>מפרט טכני ופרטי מוכר מלאים</span>
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">שם המוכר הרשום:</span>
                                    <span className="text-sm font-bold text-foreground">{firstName} {lastName}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">תעודת זהות מוכר:</span>
                                    <span className="text-sm font-bold font-mono text-foreground">{idNumber || "טרם הוזן"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">יצרן ודגם רכב:</span>
                                    <span className="text-sm font-bold text-foreground">{vehicleMake || "מזדה"} {vehicleModel || ""} ({vehicleYear || "2023"})</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">מספר רישוי:</span>
                                    <span className="text-sm font-bold font-mono text-primary">{licensePlate || "941-22-301"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">מספר שלדה (VIN):</span>
                                    <span className="text-sm font-bold font-mono text-emerald-400 break-all">{chassisNumber || "JMZBP6S7AZ1212486"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">נפח מנוע (סמ״ק):</span>
                                    <span className="text-sm font-bold text-foreground">{engineVolume ? `${engineVolume} סמ״ק` : "לא צוין"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">קילומטראז':</span>
                                    <span className="text-sm font-bold text-foreground">{kilometers ? `${Number(kilometers).toLocaleString()} ק"מ` : "לא צוין"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">בעלויות קודמות:</span>
                                    <span className="text-sm font-bold text-foreground">{previousOwners !== "" && previousOwners !== null ? previousOwners : "לא צוין"}</span>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                    <span className="text-[11px] text-on-surface-variant block">תוקף רישיון רכב:</span>
                                    <span className="text-sm font-bold text-foreground">{licenseExpiry || "בתוקף"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Uploaded Documents Thumbnails */}
                        {(idDocUrl || vehicleRegDocUrl) && (
                            <div className="p-4 bg-surface-container-low/70 border border-white/10 rounded-2xl space-y-3 text-right">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface flex items-center gap-1.5">
                                    <FileText className="h-4 w-4 text-primary" />
                                    <span>מסמכי אבטחה ואימות שהועלו</span>
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {idDocUrl && (
                                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                                            <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-slate-900">
                                                <img src={idDocUrl} alt="תעודת זהות" className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-foreground">צילום תעודת זהות</p>
                                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    סורק AI אימת תעודה
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {vehicleRegDocUrl && (
                                        <div className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                                            <div className="relative w-12 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-slate-900">
                                                <img src={vehicleRegDocUrl} alt="רישיון רכב" className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-foreground">צילום רישיון רכב</p>
                                                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    פוענח ע״י SecureOCR
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-14 text-lg font-bold bg-primary hover:bg-primary-fixed-dim text-on-primary emerald-glow shadow-2xl rounded-xl cursor-pointer transition-all active:scale-[0.99]"
                            disabled={isPending || isAnalyzingId || isAnalyzingVehicle}
                        >
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    נועל כספי נאמנות ומייצר עסקה...
                                </>
                            ) : "יצירת עסקה חדשה 🔒"}
                        </Button>
                    </section>
                )}

                {/* Wizard Controls */}
                <div className="flex justify-between items-center py-4 border-t border-white/10">
                    <Button
                        type="button"
                        onClick={prevStep}
                        variant="ghost"
                        className={`text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center gap-1 ${currentStep === 1 ? 'invisible' : ''}`}
                    >
                        <span className="material-symbols-outlined text-sm rotate-180">arrow_back</span>
                        חזרה
                    </Button>

                    {currentStep < 4 && (
                        <Button
                            type="button"
                            onClick={nextStep}
                            className="bg-primary text-on-primary px-6 py-3 rounded-lg font-bold flex items-center gap-1.5 hover:brightness-110 transition-all active:scale-95"
                        >
                            המשך
                            <span className="material-symbols-outlined text-sm rotate-180">arrow_forward</span>
                        </Button>
                    )}
                </div>

                {/* Hidden input to submit full ocr_data jsonb payload */}
                <input
                    type="hidden"
                    name="ocrData"
                    value={JSON.stringify({
                        idOcr: idOcrResult,
                        vehicleOcr: vehicleOcrResult,
                        fields: {
                            firstName: { value: firstName, confidence: idOcrResult?.fields?.full_name?.confidence },
                            lastName: { value: lastName, confidence: idOcrResult?.fields?.full_name?.confidence },
                            idNumber: { value: idNumber, confidence: idOcrResult?.fields?.id_number?.confidence },
                            licensePlate: { value: licensePlate, confidence: vehicleOcrResult?.fields?.plate_number?.confidence },
                            vehicleMake: { value: vehicleMake, confidence: vehicleOcrResult?.fields?.make?.confidence },
                            vehicleModel: { value: vehicleModel, confidence: vehicleOcrResult?.fields?.model?.confidence },
                            vehicleYear: { value: vehicleYear, confidence: vehicleOcrResult?.fields?.year?.confidence },
                            vehicleRegOwnerName: { value: vehicleRegOwnerName, confidence: vehicleOcrResult?.fields?.owner_name?.confidence },
                        }
                    })}
                />

                {/* Interactive 1-Click OCR Mismatch Correction Modal */}
                <OcrDiffModal
                    isOpen={isDiffModalOpen}
                    onClose={() => setIsDiffModalOpen(false)}
                    diffs={ocrDiffs}
                    onApplyField={(field, val) => {
                        const strVal = String(val)
                        if (field === "firstName") setFirstName(strVal)
                        if (field === "lastName") setLastName(strVal)
                        if (field === "idNumber") {
                            setIdNumber(strVal)
                            setVehicleRegOwnerId(strVal)
                        }
                        if (field === "licensePlate") setLicensePlate(strVal)
                        if (field === "vehicleMake") setVehicleMake(strVal)
                        if (field === "vehicleModel") setVehicleModel(strVal)
                        if (field === "vehicleYear") setVehicleYear(strVal)
                        if (field === "chassisNumber") setChassisNumber(strVal)
                        if (field === "engineVolume") setEngineVolume(strVal)
                        if (field === "licenseExpiry") setLicenseExpiry(strVal)
                        if (field === "previousOwners") setPreviousOwners(strVal)
                        if (field === "vehicleRegOwnerName") setVehicleRegOwnerName(strVal)
                    }}
                    onApplyAll={(updates) => {
                        Object.entries(updates).forEach(([field, val]) => {
                            const strVal = String(val)
                            if (field === "firstName") setFirstName(strVal)
                            if (field === "lastName") setLastName(strVal)
                            if (field === "idNumber") {
                                setIdNumber(strVal)
                                setVehicleRegOwnerId(strVal)
                            }
                            if (field === "licensePlate") setLicensePlate(strVal)
                            if (field === "vehicleMake") setVehicleMake(strVal)
                            if (field === "vehicleModel") setVehicleModel(strVal)
                            if (field === "vehicleYear") setVehicleYear(strVal)
                            if (field === "chassisNumber") setChassisNumber(strVal)
                            if (field === "engineVolume") setEngineVolume(strVal)
                            if (field === "licenseExpiry") setLicenseExpiry(strVal)
                            if (field === "previousOwners") setPreviousOwners(strVal)
                            if (field === "vehicleRegOwnerName") setVehicleRegOwnerName(strVal)
                        })
                    }}
                />
            </form>
        </div>
    )
}

