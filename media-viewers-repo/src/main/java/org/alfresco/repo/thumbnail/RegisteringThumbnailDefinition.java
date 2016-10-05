package org.alfresco.repo.thumbnail;

import org.alfresco.repo.thumbnail.ThumbnailDefinition;
import org.alfresco.repo.thumbnail.ThumbnailRegistry;

/**
 * Extends <code>ThumbnailDefinition</code> to allow for self registering with the
 * <code>ThumbnailRegistry</code>
 *
 * @author rgauss
 *
 */
public class RegisteringThumbnailDefinition extends ThumbnailDefinition {

	private ThumbnailRegistry thumbnailRegistry;

	public void setThumbnailRegistry(ThumbnailRegistry thumbnailRegistry) {
		this.thumbnailRegistry = thumbnailRegistry;
	}

	public void init() {
		if (thumbnailRegistry != null) {
			thumbnailRegistry.addThumbnailDefinition(this);
		}
	}

}
