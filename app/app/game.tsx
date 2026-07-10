import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  API_BASE,
  GeneratedQuest,
  getMultiplayerRoom,
  MultiplayerRoom,
  submitMultiplayerAction,
  unlockArtifact,
  uploadForm,
} from "../api";
import {
  addArtifact,
  persistArtifactImage,
  saveDocumentArtifact,
  saveSongArtifact,
} from "../lib/artifacts";
import { loadEnvironmentQuests } from "../lib/environmentQuests";
import { haversine, LatLng } from "../lib/geo";
import {
  collectMelody,
  getCollectedMelodies,
  MelodyDrop,
  melodySeed,
  moodForCategory,
} from "../lib/melodyCollection";
import PhotoReviewModal, {
  PhotoTreatment,
} from "../components/PhotoReviewModal";
import SkyQuestModal from "../components/SkyQuestModal";
import QuestRadar from "../components/QuestRadar";
import MultiplayerLobby, {
  ActiveMultiplayerSession,
} from "../components/MultiplayerLobby";
import HideSeekGame from "../components/HideSeekGame";
import {
  clearHuntProgress,
  getHuntProgress,
  saveHuntProgress,
} from "../lib/huntProgress";
import {
  getMultiplayerProfile,
  saveMultiplayerProfile,
} from "../lib/multiplayerSession";
import { RGB_THEME } from "../lib/theme";

type Target = GeneratedQuest;
type PendingPhoto = {
  uri: string;
  width: number;
  height: number;
  target: Target;
  location: LatLng;
};

export default function GameScreen() {
  const router = useRouter();
  const melodyPlayer = useAudioPlayer(null);
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationSpeed, setLocationSpeed] = useState<number | null>(null);
  const [stationaryFixes, setStationaryFixes] = useState(0);
  const [safeAreaConfirmed, setSafeAreaConfirmed] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [collectedMelodyIds, setCollectedMelodyIds] = useState<Set<string>>(
    new Set(),
  );
  const [melodyCollectionLoaded, setMelodyCollectionLoaded] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [awaitingSkyId, setAwaitingSkyId] = useState<string | null>(null);
  const [skyQuestOpen, setSkyQuestOpen] = useState(false);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [sharedPlayOpen, setSharedPlayOpen] = useState(false);
  const [multiplayerSession, setMultiplayerSession] =
    useState<ActiveMultiplayerSession | null>(null);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [inRangeId, setInRangeId] = useState<string | null>(null);
  const [nearestId, setNearestId] = useState<string | null>(null);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [savingSongId, setSavingSongId] = useState<string | null>(null);
  const [puzzleAnswer, setPuzzleAnswer] = useState("");
  const [questSource, setQuestSource] = useState<string | null>(null);
  const [generationWarning, setGenerationWarning] = useState<string | null>(
    null,
  );

  const mapRef = useRef<MapView | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const generationStartedRef = useRef(false);
  const fittedTargetRef = useRef<string | null>(null);
  const collectingMelodyRef = useRef<string | null>(null);
  const safeAreaAnchorRef = useRef<LatLng | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch(() => {});

    Promise.all([getCollectedMelodies(), getHuntProgress()])
      .then(([melodies, progress]) => {
        setCollectedMelodyIds(new Set(melodies.map((melody) => melody.id)));
        setCompleted(new Set(progress.completedIds));
        setAwaitingSkyId(progress.awaitingSkyId);
      })
      .finally(() => {
        setMelodyCollectionLoaded(true);
        setProgressLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!progressLoaded || multiplayerSession) return;
    void saveHuntProgress({
      completedIds: [...completed],
      awaitingSkyId,
    });
  }, [awaitingSkyId, completed, multiplayerSession, progressLoaded]);

  const acceptMultiplayerSession = useCallback(
    (session: ActiveMultiplayerSession) => {
      setMultiplayerSession(session);
      setMultiplayerError(null);
      setSharedPlayOpen(false);
    },
    [],
  );

  const updateMultiplayerRoom = useCallback((room: MultiplayerRoom) => {
    setMultiplayerSession((current) =>
      current ? { ...current, room } : current,
    );
    setMultiplayerError(null);
  }, []);

  useEffect(() => {
    let active = true;
    getMultiplayerProfile()
      .then(async (profile) => {
        if (!profile.roomCode) return;
        try {
          const room = await getMultiplayerRoom(
            profile.roomCode,
            profile.playerId,
          );
          if (
            active &&
            room.players.some((player) => player.id === profile.playerId)
          ) {
            acceptMultiplayerSession({ playerId: profile.playerId, room });
          }
        } catch {
          await saveMultiplayerProfile({ ...profile, roomCode: null });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [acceptMultiplayerSession]);

  useEffect(() => {
    if (!multiplayerSession) return;
    const { room } = multiplayerSession;
    setTargets(room.quests);
    setCompleted(new Set(room.completed_ids));
    setAwaitingSkyId(null);
    generationStartedRef.current = true;
  }, [multiplayerSession]);

  useEffect(() => {
    const roomCode = multiplayerSession?.room.code;
    const playerId = multiplayerSession?.playerId;
    if (!roomCode || !playerId) return;
    let active = true;

    const refreshRoom = async () => {
      try {
        const room = await getMultiplayerRoom(roomCode, playerId);
        if (active) {
          setMultiplayerSession((current) =>
            current ? { ...current, room } : current,
          );
          setMultiplayerError(null);
        }
      } catch (error) {
        if (active) {
          setMultiplayerError(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    };

    const timer = setInterval(() => void refreshRoom(), 3_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [multiplayerSession?.playerId, multiplayerSession?.room.code]);

  const refreshNearbyQuests = useCallback(async (
    origin: LatLng,
    options?: { resetProgress?: boolean },
  ) => {
    setLoadingQuests(true);
    setGenerationWarning(null);
    setSafeAreaConfirmed(false);
    safeAreaAnchorRef.current = null;
    if (options?.resetProgress) {
      setCompleted(new Set());
      setAwaitingSkyId(null);
      setSkyQuestOpen(false);
      setPuzzleAnswer("");
      void clearHuntProgress();
    }

    try {
      const response = await loadEnvironmentQuests(origin);
      setTargets(response.quests);
      setQuestSource(response.source);
      setGenerationWarning(response.warning ?? null);
      setInRangeId(null);
      setNearestId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGenerationWarning(message);
      Alert.alert("Quest generation failed", message);
    } finally {
      setLoadingQuests(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function startLocationWatch() {
      try {
        if (!(await Location.hasServicesEnabledAsync())) {
          throw new Error("Location Services are disabled.");
        }

        const { status } =
          await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          throw new Error(
            "Precise foreground location permission is required.",
          );
        }

        let first: Location.LocationObject | null = null;
        try {
          first = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
        } catch {
          first = await Location.getLastKnownPositionAsync({
            maxAge: 60_000,
            requiredAccuracy: 200,
          });
        }

        if (!first) {
          throw new Error("No GPS fix is available yet.");
        }
        if (!mounted) return;

        acceptGameLocation(first);
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 1_000,
          },
          (position) => {
            if (mounted) acceptGameLocation(position);
          },
          (reason) => {
            if (mounted) {
              setLocationError(`GPS update failed: ${reason}`);
            }
          },
        );
      } catch (error) {
        if (!mounted) return;
        const message =
          error instanceof Error ? error.message : String(error);
        setLocationError(message);
        Alert.alert("Location unavailable", message);
      }
    }

    function acceptGameLocation(position: Location.LocationObject) {
      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const speed = position.coords.speed;
      const isStationary = speed === null || speed <= 1.5;
      const movedFromConfirmedArea =
        safeAreaAnchorRef.current !== null &&
        haversine(safeAreaAnchorRef.current, nextLocation) > 35;

      setLoc(nextLocation);
      setLocationAccuracy(position.coords.accuracy);
      setLocationSpeed(speed);
      setStationaryFixes((current) =>
        isStationary ? Math.min(current + 1, 5) : 0,
      );
      if (!isStationary || movedFromConfirmedArea) {
        safeAreaAnchorRef.current = null;
        setSafeAreaConfirmed(false);
      }
      setLocationError(null);
    }

    startLocationWatch();

    return () => {
      mounted = false;
      watchRef.current?.remove();
    };
  }, []);

  const locationReliable =
    locationAccuracy !== null && locationAccuracy <= 35;

  useEffect(() => {
    if (
      !loc ||
      multiplayerSession ||
      generationStartedRef.current
    ) {
      return;
    }
    generationStartedRef.current = true;
    void refreshNearbyQuests(loc);
  }, [loc, multiplayerSession, refreshNearbyQuests]);

  const visibleTargets = useMemo(() => {
    return targets
      .filter((t) => !completed.has(t.id))
      .sort((a, b) => a.order - b.order)
      .slice(0, 3);
  }, [targets, completed]);

  const activeTarget =
    visibleTargets.find((target) => target.id === (inRangeId ?? nearestId)) ??
    visibleTargets[0];
  const requiresSafeAreaConfirmation = Boolean(
    activeTarget?.requires_safe_area_confirmation,
  );
  const safeAreaReady =
    !requiresSafeAreaConfirmation || safeAreaConfirmed;
  const multiplayerRoom = multiplayerSession?.room ?? null;
  const multiplayerPlayer =
    multiplayerRoom?.players.find(
      (player) => player.id === multiplayerSession?.playerId,
    ) ?? null;
  const sharedProgress =
    multiplayerRoom &&
    activeTarget &&
    multiplayerRoom.progress.quest_id === activeTarget.id
      ? multiplayerRoom.progress
      : null;
  const melodyReady = multiplayerRoom
    ? Boolean(sharedProgress?.melody_by)
    : activeTarget
      ? collectedMelodyIds.has(`melody-${activeTarget.id}`)
      : false;
  const photoReady = multiplayerRoom
    ? Boolean(sharedProgress?.photo_by)
    : Boolean(activeTarget && awaitingSkyId === activeTarget.id);
  const mySkyLocked = Boolean(
    multiplayerSession &&
      sharedProgress?.sky_by.includes(multiplayerSession.playerId),
  );

  const melodyDrops = useMemo<MelodyDrop[]>(() => {
    return visibleTargets
      .filter((target) => !target.song_id && !target.document_id)
      .map((target) => {
        const id = `melody-${target.id}`;
        return {
          id,
          latitude: target.latitude,
          longitude: target.longitude,
          locationName: target.name,
          mood: moodForCategory(target.category),
          seed: melodySeed(id),
        };
      });
  }, [visibleTargets]);

  useEffect(() => {
    if (
      !loc ||
      !locationReliable ||
      !safeAreaReady ||
      !melodyCollectionLoaded ||
      collectingMelodyRef.current
    ) {
      return;
    }

    const nearby = melodyDrops.find((drop) => {
      const multiplayerCanRecover =
        multiplayerRoom?.status === "active" &&
        multiplayerPlayer?.role === "pathfinder" &&
        !sharedProgress?.melody_by;
      if (
        multiplayerRoom ? !multiplayerCanRecover : collectedMelodyIds.has(drop.id)
      ) {
        return false;
      }
      const target = targets.find(
        (candidate) => `melody-${candidate.id}` === drop.id,
      );
      const collectionRadius = Math.max(
        45,
        Math.min(target?.radius ?? 45, 80),
      );
      return (
        haversine(loc, {
          latitude: drop.latitude,
          longitude: drop.longitude,
        }) <= collectionRadius
      );
    });

    if (!nearby) return;
    const dropToCollect = nearby;
    collectingMelodyRef.current = dropToCollect.id;

    async function recoverMelody() {
      try {
        const melody = await collectMelody(dropToCollect);
        setCollectedMelodyIds((current) => new Set(current).add(melody.id));
        melodyPlayer.replace({ uri: melody.uri });
        melodyPlayer.play();
        if (multiplayerSession && activeTarget) {
          const room = await submitMultiplayerAction(
            multiplayerSession.room.code,
            {
              player_id: multiplayerSession.playerId,
              quest_id: activeTarget.id,
              action: "melody",
              safe_area_confirmed: safeAreaConfirmed,
            },
          );
          setMultiplayerSession((current) =>
            current ? { ...current, room } : current,
          );
        }
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        Alert.alert(
          "Melody found",
          multiplayerSession
            ? `${melody.locationName} is unlocked. The Archivist can now capture the photograph.`
            : `${melody.locationName} left behind a ${melody.mood} melody. It is now saved in Melodies.`,
        );
      } catch (error) {
        Alert.alert(
          "Could not collect melody",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        collectingMelodyRef.current = null;
      }
    }

    void recoverMelody();
  }, [
    activeTarget,
    collectedMelodyIds,
    loc,
    melodyCollectionLoaded,
    melodyDrops,
    melodyPlayer,
    locationReliable,
    multiplayerPlayer?.role,
    multiplayerRoom,
    multiplayerSession,
    sharedProgress?.melody_by,
    safeAreaConfirmed,
    safeAreaReady,
    targets,
  ]);

  useEffect(() => {
    if (
      !loc ||
      !locationReliable ||
      !visibleTargets.length ||
      !safeAreaReady
    ) {
      setInRangeId(null);
      return;
    }

    let nearest: { id: string; d: number } | null = null;
    let newlyInRange: string | null = null;

    for (const t of visibleTargets) {
      const d = haversine(loc, {
        latitude: t.latitude,
        longitude: t.longitude,
      });

      if (!nearest || d < nearest.d) {
        nearest = { id: t.id, d };
      }

      if (d <= t.radius) {
        newlyInRange = t.id;
        break;
      }
    }

    setNearestId(nearest?.id ?? null);

    setInRangeId((prev) => {
      const changed = newlyInRange && newlyInRange !== prev;
      if (changed) Haptics.selectionAsync().catch(() => {});
      return newlyInRange ?? null;
    });
  }, [loc, locationReliable, safeAreaReady, visibleTargets]);

  function confirmSafeArea() {
    if (
      !loc ||
      !locationReliable ||
      stationaryFixes < 3 ||
      (locationSpeed ?? 0) > 1.5
    ) {
      Alert.alert(
        "Hold still for a moment",
        "Wait for precise GPS and three stationary readings before confirming this area.",
      );
      return;
    }
    Alert.alert(
      "Confirm a safe pedestrian area",
      "Continue only if you are stationary, fully off all roads and shoulders, and on public ground or property where you have permission. Never stop a vehicle for a quest.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "I am safely off the road",
          onPress: () => {
            safeAreaAnchorRef.current = loc;
            setSafeAreaConfirmed(true);
          },
        },
      ],
    );
  }

  const statusById = useMemo(() => {
    const map = new Map<
      string,
      "completed" | "inRange" | "nearest" | "pending"
    >();

    for (const t of targets) {
      if (completed.has(t.id)) {
        map.set(t.id, "completed");
      } else if (inRangeId === t.id) {
        map.set(t.id, "inRange");
      } else if (nearestId === t.id) {
        map.set(t.id, "nearest");
      } else {
        map.set(t.id, "pending");
      }
    }

    return map;
  }, [targets, completed, inRangeId, nearestId]);

  function pinColorFor(tid: string) {
    const status = statusById.get(tid);

    switch (status) {
      case "completed":
        return RGB_THEME.magenta;
      case "inRange":
        return RGB_THEME.lime;
      case "nearest":
        return RGB_THEME.cyan;
      default:
        return RGB_THEME.dim;
    }
  }

  function circleFillFor(tid: string) {
    const status = statusById.get(tid);

    switch (status) {
      case "completed":
        return "rgba(255,79,203,0.16)";
      case "inRange":
        return "rgba(183,255,90,0.18)";
      case "nearest":
        return "rgba(32,231,255,0.16)";
      default:
        return "rgba(115,124,136,0.12)";
    }
  }

  async function completeCurrent() {
    if (!loc) return;

    const activeId = inRangeId ?? nearestId;
    if (!activeId) return;

    const target = visibleTargets.find((t) => t.id === activeId);
    if (!target) return;
    if (target.requires_safe_area_confirmation && !safeAreaConfirmed) {
      confirmSafeArea();
      return;
    }

    const distance = haversine(loc, {
      latitude: target.latitude,
      longitude: target.longitude,
    });

    if (distance > target.radius) {
      Alert.alert(
        "Get closer",
        `You're ${distance.toFixed(0)} m away. Enter the circle to complete.`
      );
      return;
    }

    if (multiplayerRoom) {
      if (multiplayerRoom.status === "waiting") {
        Alert.alert("Waiting for player two", "Share the room code to begin.");
        return;
      }
      if (photoReady) {
        if (mySkyLocked) {
          Alert.alert(
            "Sky signal locked",
            "Waiting for the other player to lock the same sky signal.",
          );
        } else {
          setSkyQuestOpen(true);
        }
        return;
      }
      if (!melodyReady) {
        Alert.alert(
          multiplayerPlayer?.role === "pathfinder"
            ? "Recovering melody"
            : "Waiting for the Pathfinder",
          multiplayerPlayer?.role === "pathfinder"
            ? "Remain inside the circle while the signal is recovered."
            : "The Pathfinder must reach this location and recover its melody.",
        );
        return;
      }
      if (multiplayerPlayer?.role !== "archivist") {
        Alert.alert(
          "Archivist's turn",
          "The Archivist must take and process the location photograph.",
        );
        return;
      }
    } else if (awaitingSkyId === target.id) {
      setSkyQuestOpen(true);
      return;
    } else if (!collectedMelodyIds.has(`melody-${target.id}`)) {
      Alert.alert(
        "Listen for the signal",
        "Remain inside the circle while the location melody is recovered.",
      );
      return;
    }

    const { status: cam } = await ImagePicker.requestCameraPermissionsAsync();

    if (cam !== "granted") {
      Alert.alert("Camera needed", "Please allow camera access.");
      return;
    }

    await takeQuestPhoto(target, loc);
  }

  async function readDocumentArtifact(target: Target) {
    if (
      !loc ||
      !target.document_id ||
      !target.document_url ||
      inRangeId !== target.id ||
      !safeAreaReady ||
      savingDocumentId
    ) {
      return;
    }
    setSavingDocumentId(target.document_id);
    try {
      const documentRemoteUrl = target.document_url.startsWith("http")
        ? target.document_url
        : `${API_BASE}${target.document_url}`;
      const documentSourceRemoteUrl = target.document_source_url
        ? target.document_source_url.startsWith("http")
          ? target.document_source_url
          : `${API_BASE}${target.document_source_url}`
        : undefined;
      await saveDocumentArtifact({
        questId: target.id,
        questName: target.name,
        questDescription: target.description,
        source: target.source,
        latitude: target.latitude,
        longitude: target.longitude,
        documentId: target.document_id,
        documentKind: target.document_kind,
        documentRemoteUrl,
        documentSourceRemoteUrl,
      });
      setCompleted((current) => new Set(current).add(target.id));
      setPanelMinimized(true);
      await Linking.openURL(documentRemoteUrl);
    } catch (caught) {
      Alert.alert(
        "Could not save document",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSavingDocumentId(null);
    }
  }

  async function collectSongArtifact(target: Target) {
    if (
      !target.song_id ||
      inRangeId !== target.id ||
      !safeAreaReady ||
      savingSongId
    ) {
      return;
    }
    setSavingSongId(target.song_id);
    try {
      const response = await unlockArtifact({
        artifact_kind: "song",
        artifact_id: target.song_id,
        answer: puzzleAnswer.trim(),
      });
      if (response.artifact_kind !== "song") {
        throw new Error("The unlocked artifact was not a song.");
      }
      const published = response.song;
      const artifact = await saveSongArtifact({
        questId: target.id,
        questName: target.name,
        questDescription: target.description,
        source: target.source,
        latitude: target.latitude,
        longitude: target.longitude,
        songId: published.id,
        song: published.composition,
        songRemoteUrl: published.song_url,
      });
      if (artifact.songUri) {
        melodyPlayer.replace({ uri: artifact.songUri });
        melodyPlayer.play();
      }
      setCompleted((current) => new Set(current).add(target.id));
      setPanelMinimized(true);
      setPuzzleAnswer("");
      Alert.alert(
        "Song recovered",
        `${published.title} is playing and has been saved in Artifacts.`,
      );
    } catch (caught) {
      Alert.alert(
        "Could not recover song",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSavingSongId(null);
    }
  }

  async function solveArtifactPuzzle(target: Target) {
    const artifactKind = target.document_id ? "document" : "song";
    const artifactId = target.document_id ?? target.song_id;
    if (
      !artifactId ||
      !puzzleAnswer.trim() ||
      inRangeId !== target.id ||
      !safeAreaReady ||
      savingDocumentId ||
      savingSongId
    ) {
      return;
    }
    if (artifactKind === "song") {
      await collectSongArtifact(target);
      return;
    }

    setSavingDocumentId(artifactId);
    try {
      const response = await unlockArtifact({
        artifact_kind: "document",
        artifact_id: artifactId,
        answer: puzzleAnswer.trim(),
      });
      if (response.artifact_kind !== "document") {
        throw new Error("The unlocked artifact was not a document.");
      }
      const document = response.document;
      const documentRemoteUrl = document.pdf_url.startsWith("http")
        ? document.pdf_url
        : `${API_BASE}${document.pdf_url}`;
      const sourceRemoteUrl = document.source_url.startsWith("http")
        ? document.source_url
        : `${API_BASE}${document.source_url}`;
      await saveDocumentArtifact({
        questId: target.id,
        questName: target.name,
        questDescription: target.description,
        source: target.source,
        latitude: target.latitude,
        longitude: target.longitude,
        documentId: document.id,
        documentKind: document.document_kind,
        documentRemoteUrl,
        documentSourceRemoteUrl: sourceRemoteUrl,
      });
      setCompleted((current) => new Set(current).add(target.id));
      setPanelMinimized(true);
      setPuzzleAnswer("");
      await Linking.openURL(documentRemoteUrl);
    } catch (caught) {
      Alert.alert(
        "Still locked",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSavingDocumentId(null);
    }
  }

  async function takeQuestPhoto(target: Target, location: LatLng) {
    const shot = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (shot.canceled) return;
    const asset = shot.assets[0];
    setPendingPhoto({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      target,
      location,
    });
  }

  async function retakePendingPhoto() {
    if (!pendingPhoto) return;
    await takeQuestPhoto(pendingPhoto.target, pendingPhoto.location);
  }

  async function saveReviewedPhoto(
    imageUri: string,
    treatment: PhotoTreatment,
  ) {
    if (!pendingPhoto) return;
    const { target, location } = pendingPhoto;
    const form = new FormData();

    form.append("file", {
      uri: imageUri,
      name: `quest-${target.id}-${Date.now()}.jpg`,
      type: "image/jpeg",
    } as any);

    form.append("quest_id", target.id);
    form.append("quest_name", target.name);
    form.append("quest_description", target.description);
    form.append("quest_kind", target.kind);
    form.append("latitude", String(location.latitude));
    form.append("longitude", String(location.longitude));
    form.append("target_latitude", String(target.latitude));
    form.append("target_longitude", String(target.longitude));
    form.append("treatment", treatment);
    if (multiplayerSession) {
      form.append("room_code", multiplayerSession.room.code);
      form.append("player_id", multiplayerSession.playerId);
    }

    await uploadForm(form);

    const artifactSaved = await rememberArtifact(
      target,
      location,
      imageUri,
      treatment,
      pendingPhoto.uri,
    );
    setPendingPhoto(null);
    if (multiplayerSession) {
      const room = await submitMultiplayerAction(
        multiplayerSession.room.code,
        {
          player_id: multiplayerSession.playerId,
          quest_id: target.id,
          action: "photo",
          safe_area_confirmed: safeAreaConfirmed,
        },
      );
      setMultiplayerSession((current) =>
        current ? { ...current, room } : current,
      );
    } else {
      setAwaitingSkyId(target.id);
    }
    Alert.alert(
      "Ground signal captured",
      artifactSaved
        ? multiplayerSession
          ? "The shared photograph is saved. Both players must now lock the sky signal."
          : "Your processed photo is in Artifacts. Complete the sky signal to finish this hunt."
        : "The photo uploaded, but its local artifact could not be saved.",
    );
  }

  async function completeSkyQuest(targetName: string) {
    if (multiplayerSession && activeTarget) {
      try {
        const previousQuestId = multiplayerSession.room.progress.quest_id;
        const room = await submitMultiplayerAction(
          multiplayerSession.room.code,
          {
            player_id: multiplayerSession.playerId,
            quest_id: activeTarget.id,
            action: "sky",
          },
        );
        setMultiplayerSession((current) =>
          current ? { ...current, room } : current,
        );
        setSkyQuestOpen(false);
        const advanced = room.progress.quest_id !== previousQuestId;
        Alert.alert(
          advanced ? "Shared hunt complete" : "Your sky signal is locked",
          advanced
            ? `Both players connected the melody, photograph, and ${targetName}.`
            : "Waiting for the other player to lock their sky signal.",
        );
      } catch (error) {
        Alert.alert(
          "Could not lock sky signal",
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }

    if (!awaitingSkyId) return;
    const completedId = awaitingSkyId;
    setCompleted((current) => new Set(current).add(completedId));
    setPanelMinimized(true);
    setAwaitingSkyId(null);
    setSkyQuestOpen(false);
    Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => {});
    Alert.alert(
      "Signal hunt complete",
      `You connected the place melody, photograph, and ${targetName}. The next hunt is now available.`,
    );
  }

  async function rememberArtifact(
    target: Target,
    completionLocation: LatLng,
    imageUri?: string,
    treatment?: PhotoTreatment,
    originalImageUri?: string,
  ) {
    try {
      const persistentImageUri = imageUri
        ? await persistArtifactImage(imageUri, target.id)
        : undefined;
      const persistentOriginalUri =
        originalImageUri && treatment && treatment !== "original"
          ? await persistArtifactImage(
              originalImageUri,
              `${target.id}-original`,
            )
          : persistentImageUri;
      await addArtifact({
        questId: target.id,
        questName: target.name,
        questDescription: target.description,
        category: target.category,
        kind: target.kind,
        source: target.source,
        latitude: completionLocation.latitude,
        longitude: completionLocation.longitude,
        imageUri: persistentImageUri,
        originalImageUri: persistentOriginalUri,
        treatment,
      });
      return true;
    } catch {
      return false;
    }
  }

  function resetQuestProgress() {
    setCompleted(new Set());
    setAwaitingSkyId(null);
    setSkyQuestOpen(false);
    setInRangeId(null);
    setNearestId(null);
    setSafeAreaConfirmed(false);
    setPanelMinimized(false);
    safeAreaAnchorRef.current = null;
    void clearHuntProgress();
  }

  async function leaveMultiplayerRoom() {
    const profile = await getMultiplayerProfile();
    await saveMultiplayerProfile({ ...profile, roomCode: null });
    setMultiplayerSession(null);
    setMultiplayerError(null);
    setTargets([]);
    setCompleted(new Set());
    setInRangeId(null);
    setNearestId(null);
    setSafeAreaConfirmed(false);
    safeAreaAnchorRef.current = null;
    generationStartedRef.current = false;
  }

  useEffect(() => {
    const fitKey = activeTarget
      ? `${activeTarget.id}:${panelMinimized ? "mini" : "full"}`
      : null;
    if (
      !loc ||
      !activeTarget ||
      !mapRef.current ||
      fittedTargetRef.current === fitKey
    ) {
      return;
    }

    fittedTargetRef.current = fitKey;
    mapRef.current.fitToCoordinates(
      [
        loc,
        {
          latitude: activeTarget.latitude,
          longitude: activeTarget.longitude,
        },
      ],
      {
        animated: true,
        edgePadding: {
          top: 80,
          right: 56,
          bottom: panelMinimized ? 130 : 300,
          left: 56,
        },
      },
    );
  }, [activeTarget, loc, panelMinimized]);

  const activeDistance =
    loc && activeTarget
      ? haversine(loc, {
          latitude: activeTarget.latitude,
          longitude: activeTarget.longitude,
        })
      : null;
  const activeMelodyCollected = melodyReady;
  const activeAwaitingSky = photoReady;
  const stage = activeAwaitingSky ? 3 : activeMelodyCollected ? 2 : 1;
  const activeQuestCount = visibleTargets.length;

  if (!loc) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          {locationError ?? "Finding your location..."}
        </Text>
      </View>
    );
  }

  if (!locationReliable && !multiplayerSession) {
    return (
      <View style={styles.center}>
        <Text style={styles.locationWaitTitle}>Waiting for precise GPS</Text>
        <Text style={styles.locationWaitCopy}>
          Grant precise location and move near an open view of the sky.
          {locationAccuracy === null
            ? ""
            : ` Current accuracy is ±${Math.round(locationAccuracy)} m.`}
        </Text>
      </View>
    );
  }

  if (sharedPlayOpen && !multiplayerSession) {
    return (
      <MultiplayerLobby
        location={loc}
        onSession={acceptMultiplayerSession}
        onClose={() => setSharedPlayOpen(false)}
      />
    );
  }

  if (multiplayerSession?.room.status === "waiting") {
    return (
      <View style={styles.roomScreen}>
        <Text style={styles.roomKicker}>ROOM READY</Text>
        <Text selectable style={styles.roomCode}>
          {multiplayerSession.room.code}
        </Text>
        <Text style={styles.roomTitle}>Waiting for the second player</Text>
        <Text style={styles.roomCopy}>
          {multiplayerSession.room.mode === "hide_seek"
            ? "Enter this code on the other phone. The creator is the Hider; the joining player becomes the Seeker."
            : "Enter this code on the other phone. The creator is the Pathfinder; the joining player becomes the Archivist."}
        </Text>
        {multiplayerError ? (
          <Text style={styles.warning}>{multiplayerError}</Text>
        ) : null}
        <Button
          color={RGB_THEME.magenta}
          title="Leave room"
          onPress={() => void leaveMultiplayerRoom()}
        />
      </View>
    );
  }

  if (
    multiplayerSession &&
    multiplayerSession.room.mode === "hide_seek"
  ) {
    return (
      <HideSeekGame
        location={loc}
        locationAccuracy={locationAccuracy}
        safeAreaConfirmed={safeAreaConfirmed}
        stationaryFixes={stationaryFixes}
        onConfirmSafeArea={confirmSafeArea}
        onLeave={() => void leaveMultiplayerRoom()}
        onRoom={updateMultiplayerRoom}
        session={multiplayerSession}
      />
    );
  }

  if (multiplayerSession?.room.status === "complete") {
    return (
      <View style={styles.roomScreen}>
        <Text style={styles.roomKicker}>SIGNALS CONNECTED</Text>
        <Text style={styles.roomTitle}>Shared hunt complete</Text>
        <Text style={styles.roomCopy}>
          Both players completed every location melody, photograph, and sky
          signal in room {multiplayerSession.room.code}.
        </Text>
        <Button
          color={RGB_THEME.cyan}
          title="Create or join another room"
          onPress={() => void leaveMultiplayerRoom()}
        />
      </View>
    );
  }

  if (loadingQuests && !targets.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>
          Reading the surrounding environment...
        </Text>
      </View>
    );
  }

  const sourceLabel = multiplayerRoom
    ? `Room ${multiplayerRoom.code} · ${multiplayerPlayer?.role ?? "player"} · ${multiplayerRoom.players.length}/2 players`
    : questSource?.includes("openstreetmap")
      ? "Generated from nearby public map features"
      : questSource?.includes("procedural-stationary")
        ? "Stay-put rural activity at your current location"
      : targets.length
        ? "Generated from road-buffered public map features"
        : "No verified road-safe destinations";
  const questInstruction = multiplayerRoom
    ? photoReady
      ? mySkyLocked
        ? "Your sky signal is locked. The other player must complete their sky scan."
        : "The shared photograph is saved. Open the sky lens and lock your own Sun or constellation signal."
      : melodyReady
        ? multiplayerPlayer?.role === "archivist"
          ? "The Pathfinder recovered the melody. Photograph this place and choose a memory treatment."
          : "Your melody is synchronized. Wait for the Archivist to capture and process the photograph."
        : multiplayerPlayer?.role === "pathfinder"
          ? activeTarget?.description ?? ""
          : "Travel to the shared destination. The Pathfinder must enter the signal radius and recover the melody."
    : activeTarget?.song_id
      ? activeTarget.description
    : activeAwaitingSky
      ? "Your photograph captured the ground signal. Use the live sky lens to align the Sun or a visible constellation."
      : activeMelodyCollected
        ? "The location melody is saved. Photograph what makes this place distinct, then choose a memory treatment."
        : activeTarget?.description ?? "";
  const actionTitle = !inRangeId
    ? "Get closer"
    : multiplayerRoom
      ? photoReady
        ? mySkyLocked
          ? "Waiting for player"
          : "Open sky lens"
        : melodyReady
          ? multiplayerPlayer?.role === "archivist"
            ? "Take signal photo"
            : "Waiting for Archivist"
          : multiplayerPlayer?.role === "pathfinder"
            ? "Recovering melody..."
            : "Waiting for Pathfinder"
      : activeAwaitingSky
        ? "Open sky lens"
        : activeMelodyCollected
          ? "Take signal photo"
          : "Recovering melody...";
  const actionDisabled =
    !inRangeId ||
    !safeAreaReady ||
    (multiplayerRoom
      ? mySkyLocked ||
        (!photoReady &&
          (melodyReady
            ? multiplayerPlayer?.role !== "archivist"
            : true))
      : !activeMelodyCollected && !activeAwaitingSky);

  return (
    <View style={styles.container}>
      <PhotoReviewModal
        onCancel={() => setPendingPhoto(null)}
        onRetake={() => void retakePendingPhoto()}
        onSave={saveReviewedPhoto}
        photo={
          pendingPhoto
            ? {
                uri: pendingPhoto.uri,
                width: pendingPhoto.width,
                height: pendingPhoto.height,
              }
            : null
        }
        questName={pendingPhoto?.target.name ?? ""}
      />
      <SkyQuestModal
        onClose={() => setSkyQuestOpen(false)}
        onComplete={completeSkyQuest}
        placeName={activeTarget?.name ?? "this place"}
        visible={skyQuestOpen}
      />

      {Platform.OS === "android" ? (
        <QuestRadar
          inRange={inRangeId === activeTarget?.id}
          location={loc}
          melodyCollected={activeMelodyCollected}
          target={activeTarget}
        />
      ) : (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          showsUserLocation
          followsUserLocation
          initialRegion={{
            latitude: loc.latitude,
            longitude: loc.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {visibleTargets.map((target) => (
            <React.Fragment key={target.id}>
              <Circle
                center={{
                  latitude: target.latitude,
                  longitude: target.longitude,
                }}
                radius={target.radius}
                fillColor={circleFillFor(target.id)}
                strokeColor={pinColorFor(target.id)}
              />

              <Marker
                coordinate={{
                  latitude: target.latitude,
                  longitude: target.longitude,
                }}
                pinColor={pinColorFor(target.id)}
                title={target.name}
                description={target.description}
              />
            </React.Fragment>
          ))}

          {melodyDrops
            .filter((drop) =>
              multiplayerRoom
                ? !sharedProgress?.melody_by
                : !collectedMelodyIds.has(drop.id),
            )
            .map((drop) => (
              <Marker
                key={drop.id}
                coordinate={{
                  latitude: drop.latitude,
                  longitude: drop.longitude,
                }}
                title="Uncollected melody"
                description={`Explore ${drop.locationName} to collect it.`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.melodyMarker}>
                  <Text style={styles.melodyMarkerText}>♪</Text>
                </View>
              </Marker>
            ))}
        </MapView>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/terminal")}
        style={styles.terminalButton}
      >
        <Text style={styles.terminalButtonText}>TERM</Text>
      </Pressable>

      {panelMinimized ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setPanelMinimized(false)}
          style={styles.panelWidget}
        >
          <View style={styles.widgetHeader}>
            <Text numberOfLines={1} style={styles.widgetTitle}>
              {activeTarget?.name ?? "Explore"}
            </Text>
            <Text style={styles.widgetAction}>Expand</Text>
          </View>
          <Text numberOfLines={1} style={styles.widgetMeta}>
            {activeDistance !== null
              ? `${activeDistance.toFixed(0)} m away`
              : sourceLabel}
          </Text>
          <Text style={styles.widgetProgress}>
            {completed.size} complete · {activeQuestCount} active
          </Text>
        </Pressable>
      ) : (
        <ScrollView
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          style={styles.panel}
        >
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.heading}>Explore</Text>
            <Text style={styles.progressCount}>
              {completed.size} complete · {activeQuestCount} active
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPanelMinimized(true)}
            style={styles.minimizeButton}
          >
            <Text style={styles.minimizeText}>Minimize</Text>
          </Pressable>
        </View>
        {!activeTarget?.puzzle_prompt ? (
          <View style={styles.stageRow}>
            {[
              { number: 1, label: "Melody" },
              { number: 2, label: "Photo" },
              { number: 3, label: "Sky" },
            ].map((item) => (
              <View
                key={item.number}
                style={[
                  styles.stage,
                  stage >= item.number && styles.stageActive,
                ]}
              >
                <Text
                  style={[
                    styles.stageText,
                    stage >= item.number && styles.stageTextActive,
                  ]}
                >
                  {item.number} {item.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.sourceText}>{sourceLabel}</Text>

        {generationWarning ? (
          <Text style={styles.warning}>
            Quest data could not be verified against the current road-safety
            policy.
          </Text>
        ) : null}
        {!locationReliable ? (
          <Text style={styles.warning}>
            GPS accuracy is{" "}
            {locationAccuracy === null
              ? "still being measured"
              : `±${Math.round(locationAccuracy)} m`}
            . Enable precise location and wait for a stronger fix.
          </Text>
        ) : null}
        {locationError ? (
          <Text style={styles.warning}>{locationError}</Text>
        ) : null}
        {multiplayerError ? (
          <Text style={styles.warning}>{multiplayerError}</Text>
        ) : null}

        {activeTarget ? (
          <>
            <Text style={styles.questName}>{activeTarget.name}</Text>
            <Text style={styles.questDescription}>
              {questInstruction}
            </Text>

            {requiresSafeAreaConfirmation && !safeAreaConfirmed ? (
              <>
                <Text style={styles.warning}>
                  Rural stay-put activity: remain fully off roads and shoulders.
                  Moving away will cancel this confirmation.
                </Text>
                <Button
                  color={RGB_THEME.lime}
                  title={
                    locationReliable && stationaryFixes >= 3
                      ? "Confirm safe area"
                      : locationReliable
                        ? `Hold still (${Math.min(stationaryFixes, 3)}/3)`
                        : "Waiting for precise GPS"
                  }
                  onPress={confirmSafeArea}
                  disabled={!locationReliable || stationaryFixes < 3}
                />
              </>
            ) : null}

            <Text style={styles.questText}>
              {activeDistance !== null
                ? `${activeDistance.toFixed(0)} m away`
                : ""}
            </Text>

            {activeTarget.puzzle_prompt ? (
              <View style={styles.puzzlePanel}>
                <Text style={styles.puzzleKind}>
                  {(activeTarget.puzzle_kind ?? "riddle").replaceAll("_", " ")}
                </Text>
                <Text style={styles.puzzlePrompt}>
                  {activeTarget.puzzle_prompt}
                </Text>
                <TextInput
                  autoCapitalize="none"
                  editable={
                    inRangeId === activeTarget.id &&
                    safeAreaReady &&
                    !savingDocumentId &&
                    !savingSongId
                  }
                  onChangeText={setPuzzleAnswer}
                  onSubmitEditing={() =>
                    void solveArtifactPuzzle(activeTarget)
                  }
                  placeholder="Enter your answer"
                  placeholderTextColor={RGB_THEME.dim}
                  returnKeyType="done"
                  selectionColor={RGB_THEME.cyan}
                  style={styles.puzzleInput}
                  value={puzzleAnswer}
                />
                <Button
                  color={RGB_THEME.lime}
                  disabled={
                    !puzzleAnswer.trim() ||
                    inRangeId !== activeTarget.id ||
                    !safeAreaReady ||
                    Boolean(savingDocumentId || savingSongId)
                  }
                  onPress={() => void solveArtifactPuzzle(activeTarget)}
                  title={
                    savingDocumentId || savingSongId
                      ? "Checking answer..."
                      : inRangeId === activeTarget.id
                        ? "Unlock artifact"
                        : "Reach the signal to solve"
                  }
                />
              </View>
            ) : null}

            {activeTarget.document_url && !activeTarget.puzzle_prompt ? (
              <Button
                color={RGB_THEME.magenta}
                disabled={
                  inRangeId !== activeTarget.id ||
                  !safeAreaReady ||
                  savingDocumentId === activeTarget.document_id
                }
                onPress={() => void readDocumentArtifact(activeTarget)}
                title={
                  savingDocumentId === activeTarget.document_id
                    ? "Saving PDF..."
                    : inRangeId === activeTarget.id
                    ? "Read the document"
                    : "Reach the signal to read"
                }
              />
            ) : null}

            {activeTarget.song_id && !activeTarget.puzzle_prompt ? (
              <Button
                color={RGB_THEME.cyan}
                disabled={
                  inRangeId !== activeTarget.id ||
                  !safeAreaReady ||
                  savingSongId === activeTarget.song_id
                }
                onPress={() => void collectSongArtifact(activeTarget)}
                title={
                  savingSongId === activeTarget.song_id
                    ? "Rendering 8-bit song..."
                    : inRangeId === activeTarget.id
                      ? "Recover song"
                      : "Reach the signal to listen"
                }
              />
            ) : !activeTarget.puzzle_prompt ? (
              <Button
                color={RGB_THEME.cyan}
                title={actionTitle}
                onPress={completeCurrent}
                disabled={actionDisabled}
              />
            ) : null}

            {multiplayerRoom ? (
              <Button
                color={RGB_THEME.magenta}
                title="Leave multiplayer room"
                onPress={() => void leaveMultiplayerRoom()}
              />
            ) : (
              <>
                <Button
                  color={RGB_THEME.magenta}
                  title="Play together"
                  onPress={() => setSharedPlayOpen(true)}
                />
                <Button
                  color={RGB_THEME.dim}
                  title="Reset quest progress"
                  onPress={resetQuestProgress}
                />
                <Button
                  color={RGB_THEME.cyan}
                  title={
                    loadingQuests ? "Refreshing..." : "Find new nearby quests"
                  }
                  onPress={() =>
                    refreshNearbyQuests(loc, { resetProgress: true })
                  }
                  disabled={loadingQuests}
                />
              </>
            )}
          </>
        ) : (
          <>
            <Text style={styles.questText}>
              {targets.length
                ? "All quests complete."
                : "No road-safe quests were found nearby. Try again from another public area."}
            </Text>
            <Button
              color={RGB_THEME.cyan}
              title={loadingQuests ? "Refreshing..." : "Find new nearby quests"}
              onPress={() => refreshNearbyQuests(loc, { resetProgress: true })}
              disabled={loadingQuests}
            />
          </>
        )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: RGB_THEME.background, flex: 1 },

  center: {
    flex: 1,
    alignItems: "center",
    backgroundColor: RGB_THEME.background,
    justifyContent: "center",
    padding: 28,
  },

  centerText: {
    color: RGB_THEME.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  locationWaitTitle: {
    color: RGB_THEME.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },

  locationWaitCopy: {
    color: RGB_THEME.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },

  roomScreen: {
    backgroundColor: RGB_THEME.background,
    flex: 1,
    justifyContent: "center",
    padding: 28,
  },

  roomKicker: {
    color: RGB_THEME.cyan,
    fontSize: 11,
    fontWeight: "900",
  },

  roomCode: {
    color: RGB_THEME.magenta,
    fontSize: 46,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 8,
  },

  roomTitle: {
    color: RGB_THEME.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 16,
  },

  roomCopy: {
    color: RGB_THEME.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
    marginTop: 8,
  },

  terminalButton: {
    alignItems: "center",
    backgroundColor: "rgba(8,10,12,0.92)",
    borderColor: RGB_THEME.cyan,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 13,
    position: "absolute",
    right: 16,
    top: 16,
  },

  terminalButtonText: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
  },

  panel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: "rgba(23,26,31,0.96)",
    borderColor: RGB_THEME.borderStrong,
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: "74%",
  },

  panelContent: {
    gap: 10,
    padding: 16,
  },

  panelWidget: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    backgroundColor: "rgba(23,26,31,0.96)",
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  widgetHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  widgetTitle: {
    color: RGB_THEME.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },

  widgetAction: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  widgetMeta: {
    color: RGB_THEME.muted,
    fontSize: 13,
    fontWeight: "600",
  },

  widgetProgress: {
    color: RGB_THEME.lime,
    fontSize: 12,
    fontWeight: "800",
  },

  heading: {
    color: RGB_THEME.text,
    fontSize: 20,
    fontWeight: "700",
  },

  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },

  progressCount: {
    color: RGB_THEME.cyan,
    fontSize: 12,
    fontWeight: "800",
  },

  minimizeButton: {
    alignItems: "center",
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },

  minimizeText: {
    color: RGB_THEME.text,
    fontSize: 12,
    fontWeight: "800",
  },

  stageRow: {
    flexDirection: "row",
    gap: 6,
  },

  stage: {
    alignItems: "center",
    backgroundColor: RGB_THEME.surfaceRaised,
    borderRadius: 3,
    flex: 1,
    minHeight: 28,
    justifyContent: "center",
  },

  stageActive: {
    backgroundColor: RGB_THEME.cyan,
  },

  stageText: {
    color: RGB_THEME.muted,
    fontSize: 11,
    fontWeight: "800",
  },

  stageTextActive: {
    color: RGB_THEME.black,
  },

  sourceText: {
    fontSize: 12,
    color: RGB_THEME.muted,
  },

  questName: {
    color: RGB_THEME.text,
    fontSize: 18,
    fontWeight: "700",
  },

  questText: {
    color: RGB_THEME.text,
    fontSize: 18,
  },

  questDescription: {
    color: RGB_THEME.muted,
    fontSize: 15,
    opacity: 0.8,
    marginBottom: 8,
  },

  warning: {
    fontSize: 14,
    color: RGB_THEME.amber,
    fontWeight: "600",
  },

  puzzlePanel: {
    backgroundColor: RGB_THEME.black,
    borderColor: RGB_THEME.magenta,
    borderRadius: 4,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },

  puzzleKind: {
    color: RGB_THEME.magenta,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  puzzlePrompt: {
    color: RGB_THEME.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },

  puzzleInput: {
    backgroundColor: RGB_THEME.surface,
    borderColor: RGB_THEME.borderStrong,
    borderRadius: 4,
    borderWidth: 1,
    color: RGB_THEME.text,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
  },

  melodyMarker: {
    alignItems: "center",
    backgroundColor: RGB_THEME.magenta,
    borderColor: RGB_THEME.text,
    borderRadius: 18,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    shadowColor: RGB_THEME.magenta,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    width: 36,
  },

  melodyMarkerText: {
    color: RGB_THEME.black,
    fontSize: 22,
    fontWeight: "900",
  },
});
