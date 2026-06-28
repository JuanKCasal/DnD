import json
import logging
import ssl
from aiokafka import AIOKafkaProducer
from api.config import Settings

logger = logging.getLogger(__name__)

_producer: AIOKafkaProducer | None = None

TOPIC_SESSIONS_CREATED = "dnd.sessions.created"
TOPIC_CHARACTERS_LEVELED_UP = "dnd.characters.leveled_up"
TOPIC_INVENTORY_UPDATED = "dnd.inventory.updated"
TOPIC_CHAT_MESSAGE_SENT = "dnd.chat.message_sent"
TOPIC_DICE_ROLLED = "dnd.dice.rolled"
TOPIC_COMMUNITY_EVENT = "dnd.community.event"


async def init_producer(settings: Settings) -> None:
    global _producer
    try:
        ssl_ctx = ssl.create_default_context(cafile=settings.get_ca_cert_path())
        ssl_ctx.load_cert_chain(settings.get_kafka_cert_path(), settings.get_kafka_key_path())
        ssl_ctx.check_hostname = False

        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            security_protocol="SSL",
            ssl_context=ssl_ctx,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
        )
        await _producer.start()
        logger.info("Kafka producer initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Kafka producer: {e}")
        _producer = None


async def close_producer() -> None:
    global _producer
    if _producer:
        try:
            await _producer.stop()
        except Exception as e:
            logger.error(f"Error closing Kafka producer: {e}")
        _producer = None
        logger.info("Kafka producer closed")


async def publish_event(topic: str, payload: dict) -> None:
    """Fire-and-forget Kafka publish. Logs errors but never raises."""
    if _producer is None:
        logger.warning(f"Kafka producer not available, skipping event on topic {topic}")
        return
    try:
        await _producer.send_and_wait(topic, value=payload)
    except Exception as e:
        logger.error(f"Failed to publish event to {topic}: {e}")


def get_producer() -> AIOKafkaProducer | None:
    return _producer
