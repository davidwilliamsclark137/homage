import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Canvas,
  ColorMatrix,
  FilterMode,
  Image as SkiaImage,
  ImageFormat,
  MipmapMode,
  useCanvasRef,
  useImage,
} from "@shopify/react-native-skia";
import * as FileSystem from "expo-file-system/legacy";
import {
  manipulateAsync,
  SaveFormat,
} from "expo-image-manipulator";
import { RGB_THEME } from "../lib/theme";

export type PhotoTreatment =
  | "original"
  | "faded"
  | "night"
  | "field-notes"
  | "8-bit";

type PhotoSource = {
  uri: string;
  width: number;
  height: number;
};

type Props = {
  photo: PhotoSource | null;
  questName: string;
  onCancel: () => void;
  onRetake: () => void;
  onSave: (uri: string, treatment: PhotoTreatment) => Promise<void>;
};

const TREATMENTS: { id: PhotoTreatment; label: string }[] = [
  { id: "original", label: "Original" },
  { id: "faded", label: "Faded" },
  { id: "night", label: "Night" },
  { id: "field-notes", label: "Field Notes" },
  { id: "8-bit", label: "8-Bit" },
];

const MATRICES: Record<PhotoTreatment, number[]> = {
  original: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ],
  faded: [
    0.72, 0.18, 0.08, 0, 0.06,
    0.12, 0.76, 0.08, 0, 0.04,
    0.12, 0.18, 0.62, 0, 0.01,
    0, 0, 0, 1, 0,
  ],
  night: [
    0.52, 0.08, 0.08, 0, -0.05,
    0.04, 0.62, 0.14, 0, -0.04,
    0.08, 0.16, 0.9, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  "field-notes": [
    0.28, 0.62, 0.1, 0, -0.06,
    0.28, 0.62, 0.1, 0, -0.06,
    0.28, 0.62, 0.1, 0, -0.06,
    0, 0, 0, 1, 0,
  ],
  "8-bit": [
    1.3, -0.12, -0.08, 0, 0,
    -0.08, 1.28, -0.08, 0, 0,
    -0.08, -0.12, 1.32, 0, 0,
    0, 0, 0, 1, 0,
  ],
};

export default function PhotoReviewModal({
  photo,
  questName,
  onCancel,
  onRetake,
  onSave,
}: Props) {
  const canvasRef = useCanvasRef();
  const window = useWindowDimensions();
  const [workingPhoto, setWorkingPhoto] = useState<PhotoSource | null>(photo);
  const [pixelatedUri, setPixelatedUri] = useState<string | null>(null);
  const [treatment, setTreatment] = useState<PhotoTreatment>("original");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef(0);

  useEffect(() => {
    operationRef.current += 1;
    setWorkingPhoto(photo);
    setPixelatedUri(null);
    setTreatment("original");
    setProcessing(false);
    setSaving(false);
    setError(null);
  }, [photo]);

  const displayUri =
    treatment === "8-bit" && pixelatedUri
      ? pixelatedUri
      : workingPhoto?.uri ?? null;
  const image = useImage(displayUri);

  const previewSize = useMemo(() => {
    const width = workingPhoto?.width || 3;
    const height = workingPhoto?.height || 4;
    const ratio = width / height;
    const maxWidth = window.width - 32;
    const maxHeight = window.height * 0.57;

    if (maxWidth / maxHeight < ratio) {
      return { width: maxWidth, height: maxWidth / ratio };
    }
    return { width: maxHeight * ratio, height: maxHeight };
  }, [window.height, window.width, workingPhoto]);

  async function selectTreatment(next: PhotoTreatment) {
    if (!workingPhoto || processing || saving) return;
    setTreatment(next);
    setError(null);

    if (next !== "8-bit" || pixelatedUri) return;

    const operation = ++operationRef.current;
    setProcessing(true);
    try {
      const pixelated = await manipulateAsync(
        workingPhoto.uri,
        [{ resize: { width: 96 } }],
        { compress: 1, format: SaveFormat.PNG },
      );
      if (operation === operationRef.current) {
        setPixelatedUri(pixelated.uri);
      }
    } catch (caught) {
      if (operation === operationRef.current) {
        setTreatment("original");
        setError(errorMessage(caught));
      }
    } finally {
      if (operation === operationRef.current) setProcessing(false);
    }
  }

  async function rotate() {
    if (!workingPhoto || processing || saving) return;
    const operation = ++operationRef.current;
    setProcessing(true);
    setError(null);

    try {
      const rotated = await manipulateAsync(
        workingPhoto.uri,
        [{ rotate: 90 }],
        { compress: 0.95, format: SaveFormat.JPEG },
      );
      if (operation !== operationRef.current) return;

      const nextPhoto = {
        uri: rotated.uri,
        width: workingPhoto.height,
        height: workingPhoto.width,
      };
      setWorkingPhoto(nextPhoto);
      setPixelatedUri(null);

      if (treatment === "8-bit") {
        const pixelated = await manipulateAsync(
          nextPhoto.uri,
          [{ resize: { width: 96 } }],
          { compress: 1, format: SaveFormat.PNG },
        );
        if (operation === operationRef.current) {
          setPixelatedUri(pixelated.uri);
        }
      }
    } catch (caught) {
      if (operation === operationRef.current) setError(errorMessage(caught));
    } finally {
      if (operation === operationRef.current) setProcessing(false);
    }
  }

  async function save() {
    if (!workingPhoto || !image || saving || processing) return;
    setSaving(true);
    setError(null);

    try {
      let outputUri = workingPhoto.uri;

      if (treatment !== "original") {
        if (!FileSystem.cacheDirectory || !canvasRef.current) {
          throw new Error("The processed image could not be exported.");
        }

        const snapshot = await canvasRef.current.makeImageSnapshotAsync();
        outputUri = `${FileSystem.cacheDirectory}homage-photo-${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(
          outputUri,
          snapshot.encodeToBase64(ImageFormat.JPEG, 92),
          { encoding: FileSystem.EncodingType.Base64 },
        );
      }

      await onSave(outputUri, treatment);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      presentationStyle="fullScreen"
      visible={photo !== null}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onCancel}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>Cancel</Text>
          </Pressable>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.title}>Review photo</Text>
            <Text numberOfLines={1} style={styles.questName}>
              {questName}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Rotate photo"
            accessibilityRole="button"
            disabled={processing || saving}
            onPress={rotate}
            style={styles.rotateButton}
          >
            <Text style={styles.rotateIcon}>↻</Text>
          </Pressable>
        </View>

        <View style={styles.previewArea}>
          <View
            style={[
              styles.canvasFrame,
              { width: previewSize.width, height: previewSize.height },
            ]}
          >
            <Canvas ref={canvasRef} style={StyleSheet.absoluteFill}>
              <SkiaImage
                fit="cover"
                height={previewSize.height}
                image={image}
                sampling={
                  treatment === "8-bit"
                    ? {
                        filter: FilterMode.Nearest,
                        mipmap: MipmapMode.None,
                      }
                    : undefined
                }
                width={previewSize.width}
                x={0}
                y={0}
              >
                <ColorMatrix matrix={MATRICES[treatment]} />
              </SkiaImage>
            </Canvas>

            {!image || processing ? (
              <View style={styles.loading}>
                <ActivityIndicator color={RGB_THEME.text} />
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.treatments}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {TREATMENTS.map((option) => (
            <Pressable
              key={option.id}
              disabled={processing || saving}
              onPress={() => void selectTreatment(option.id)}
              style={[
                styles.treatment,
                treatment === option.id && styles.treatmentActive,
              ]}
            >
              <Text
                style={[
                  styles.treatmentText,
                  treatment === option.id && styles.treatmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            disabled={saving}
            onPress={onRetake}
            style={styles.retakeButton}
          >
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
          <Pressable
            disabled={!image || processing || saving}
            onPress={() => void save()}
            style={[
              styles.saveButton,
              (!image || processing || saving) && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={RGB_THEME.black} />
            ) : (
              <Text style={styles.saveText}>Use photo</Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

const styles = StyleSheet.create({
  screen: { backgroundColor: RGB_THEME.background, flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 62,
    paddingHorizontal: 12,
  },
  headerButton: {
    justifyContent: "center",
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: 4,
  },
  headerButtonText: { color: RGB_THEME.muted, fontSize: 15, fontWeight: "700" },
  headerTitleGroup: { alignItems: "center", flex: 1, minWidth: 0 },
  title: { color: RGB_THEME.text, fontSize: 17, fontWeight: "800" },
  questName: {
    color: RGB_THEME.dim,
    fontSize: 11,
    marginTop: 2,
    maxWidth: "94%",
  },
  rotateButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  rotateIcon: { color: RGB_THEME.cyan, fontSize: 27 },
  previewArea: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  canvasFrame: {
    backgroundColor: RGB_THEME.surface,
    overflow: "hidden",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(8,11,16,0.48)",
    justifyContent: "center",
  },
  treatments: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  treatment: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.border,
    borderRadius: 4,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  treatmentActive: {
    backgroundColor: RGB_THEME.magenta,
    borderColor: RGB_THEME.magenta,
  },
  treatmentText: { color: RGB_THEME.muted, fontSize: 12, fontWeight: "800" },
  treatmentTextActive: { color: RGB_THEME.black },
  error: {
    color: RGB_THEME.danger,
    fontSize: 12,
    paddingHorizontal: 20,
    paddingVertical: 4,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  retakeButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  retakeText: { color: RGB_THEME.text, fontSize: 15, fontWeight: "800" },
  saveButton: {
    alignItems: "center",
    backgroundColor: RGB_THEME.lime,
    borderRadius: 4,
    flex: 1.6,
    justifyContent: "center",
    minHeight: 50,
  },
  saveText: { color: RGB_THEME.black, fontSize: 15, fontWeight: "900" },
  disabled: { opacity: 0.45 },
});
